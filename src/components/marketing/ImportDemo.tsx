"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import type { ImportBundle, InputFile } from "@/lib/import/types";
import { IMPORT_HREF } from "./site";

/*
 * A real dry run of the TV Time importer, entirely in this tab. The importer is a pure function
 * (files in, bundle out: no database, no network), so the demo shows exactly what the app would read,
 * then forgets it. Nothing is stored and nothing is uploaded.
 */

const MAX_BYTES = 200 * 1024 * 1024;

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; label: string }
  | { kind: "done"; label: string; summary: Summary }
  | { kind: "error"; message: string };

interface Summary {
  shows: number;
  movies: number;
  episodes: number;
  ratings: number;
  lists: number;
  first?: number;
  last?: number;
  top: { title: string; count: number }[];
  warnings: number;
  ms: number;
}

function summarize(b: ImportBundle, ms: number): Summary {
  const perShow = new Map<string, number>();
  let first: number | undefined;
  let last: number | undefined;
  let episodes = 0;
  for (const w of b.watches) {
    if (w.kind === "episode") {
      episodes++;
      perShow.set(w.title, (perShow.get(w.title) ?? 0) + 1);
    }
    if (w.watchedAt !== undefined) {
      first = first === undefined ? w.watchedAt : Math.min(first, w.watchedAt);
      last = last === undefined ? w.watchedAt : Math.max(last, w.watchedAt);
    }
  }
  const showTitles = new Set(perShow.keys());
  let movies = 0;
  for (const i of b.items) {
    if (i.kind === "show") showTitles.add(i.title);
    else movies++;
  }
  for (const w of b.watches) if (w.kind === "movie") movies++;
  const top = [...perShow].sort((a, z) => z[1] - a[1]).slice(0, 3).map(([title, count]) => ({ title, count }));
  return {
    shows: showTitles.size,
    movies,
    episodes,
    ratings: b.episodeRatings.length + b.items.filter((i) => i.rating !== undefined).length,
    lists: b.lists.length,
    first,
    last,
    top,
    warnings: b.warnings.length,
    ms,
  };
}

function memoryFile(name: string, text: string): InputFile {
  const bytes = new TextEncoder().encode(text);
  return { name, text: async () => text, bytes: async () => bytes };
}

function fromFile(f: File): InputFile {
  return { name: f.name, text: () => f.text(), bytes: async () => new Uint8Array(await f.arrayBuffer()) };
}

/** A small, clearly synthetic export in TV Time's CSV shape, using public shows. */
function sampleFiles(): InputFile[] {
  const seen: string[] = ["tv_show_name,episode_season_number,episode_number,created_at"];
  const add = (show: string, season: number, count: number, start: string, perDay: number) => {
    const t0 = Date.parse(`${start}T20:00:00Z`);
    for (let i = 0; i < count; i++) {
      const d = new Date(t0 + Math.floor(i / perDay) * 86_400_000 + (i % perDay) * 3_000_000);
      seen.push(`"${show}",${season},${i + 1},${d.toISOString().slice(0, 19).replace("T", " ")}`);
    }
  };
  add("Severance", 1, 9, "2022-02-18", 1);
  add("Severance", 2, 3, "2025-01-17", 1);
  add("The Bear", 1, 8, "2022-07-02", 4);
  add("Slow Horses", 1, 6, "2022-04-03", 2);
  add("Dark", 1, 10, "2018-01-06", 3);
  const followed = [
    "tv_show_name,created_at,is_favorited",
    "Severance,2022-02-18 19:00:00,1",
    "The Bear,2022-07-02 18:00:00,0",
    "Slow Horses,2022-04-03 18:00:00,0",
    "Dark,2018-01-05 18:00:00,1",
    "Shogun,2024-02-27 18:00:00,0",
  ];
  const votes = [
    "tv_show_name,episode_season_number,episode_number,vote,created_at",
    "Severance,1,9,5,2022-04-08 22:00:00",
    "The Bear,1,7,5,2022-07-03 21:00:00",
    "Dark,1,10,4,2018-01-09 22:00:00",
  ];
  return [
    memoryFile("sample/seen_episode.csv", seen.join("\n")),
    memoryFile("sample/followed_tv_show.csv", followed.join("\n")),
    memoryFile("sample/episode_vote.csv", votes.join("\n")),
  ];
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export function ImportDemo() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);
  const inputId = useId();

  const run = useCallback(async (files: InputFile[], label: string) => {
    const id = ++runId.current;
    setPhase({ kind: "reading", label });
    try {
      const t0 = performance.now();
      const { importTvTime } = await import("@/lib/import/tvtime");
      const bundle = await importTvTime(files);
      if (id !== runId.current) return;
      const summary = summarize(bundle, Math.max(1, Math.round(performance.now() - t0)));
      if (summary.episodes === 0 && summary.shows === 0 && summary.movies === 0) {
        setPhase({
          kind: "error",
          message:
            "We couldn't find TV Time data in that file. Look for the zip from TV Time's data export, or try the sample.",
        });
        return;
      }
      setPhase({ kind: "done", label, summary });
    } catch {
      if (id !== runId.current) return;
      setPhase({
        kind: "error",
        message: "That file couldn't be read. It may be damaged or not a zip. Nothing was saved, so you can try another.",
      });
    }
  }, []);

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list);
      const total = files.reduce((n, f) => n + f.size, 0);
      if (total > MAX_BYTES) {
        setPhase({ kind: "error", message: "That's larger than any TV Time export we've seen (over 200 MB). Check you picked the right file." });
        return;
      }
      void run(files.map(fromFile), files.length === 1 ? files[0].name : `${files.length} files`);
    },
    [run],
  );

  const preload = () => {
    void import("@/lib/import/tvtime");
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    onFiles(e.dataTransfer.files);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
          preload();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cx(
          "relative flex min-h-[19rem] flex-col justify-between rounded-k-md border border-dashed p-6 transition-[border-color,background-color] duration-(--k-dur-2) sm:p-8",
          dragging ? "border-accent bg-accent-wash/60" : "border-line-strong bg-surface",
        )}
      >
        <div>
          <span className="k-slate text-text-3">Dry run · runs in this tab</span>
          <p className="mt-4 font-display text-k-2xl font-medium leading-[1.1] tracking-[-0.02em]">
            Drop your TV Time zip here.
          </p>
          <p className="mt-3 max-w-[44ch] text-k-base leading-relaxed text-text-2">
            We&apos;ll read it the same way the app does and show you what came out. The file never leaves your browser, and this page forgets it when you leave.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".zip,.csv,.json"
            multiple
            className="sr-only"
            onChange={(e) => {
              onFiles(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            className={buttonClasses("secondary", "md")}
            onClick={() => inputRef.current?.click()}
            onPointerEnter={preload}
            onFocus={preload}
          >
            <Icon name="import" />
            Choose a file
          </button>
          <button
            type="button"
            className={buttonClasses("ghost", "md")}
            onClick={() => void run(sampleFiles(), "Sample export")}
            onPointerEnter={preload}
            onFocus={preload}
          >
            <Icon name="play" />
            Try a sample export
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[19rem] rounded-k-md border border-line bg-bg p-6 sm:p-8">
        <Result phase={phase} />
      </div>
    </div>
  );
}

function Result({ phase }: { phase: Phase }) {
  if (phase.kind === "idle") {
    return (
      <ol className="space-y-5">
        {[
          ["Unzip", "The archive is opened in memory with a small JavaScript library."],
          ["Read", "TV Time's CSV files are parsed: watched episodes, followed shows, votes."],
          ["Merge", "Duplicates are folded together, so a rewatch doesn't count twice."],
          ["Store", "In the app, the result is written to IndexedDB on this device. Not in this demo."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="k-slate mt-0.5 w-6 shrink-0 text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="text-k-base font-semibold">{t}</p>
              <p className="text-k-sm leading-relaxed text-text-2">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  if (phase.kind === "reading") {
    return (
      <div className="space-y-4" aria-busy>
        <p className="text-k-sm text-text-2">
          Reading <span className="font-semibold text-text">{phase.label}</span> locally…
        </p>
        <div className="k-skeleton h-10 rounded-k-sm" />
        <div className="grid grid-cols-3 gap-3">
          <div className="k-skeleton h-16 rounded-k-sm" />
          <div className="k-skeleton h-16 rounded-k-sm" />
          <div className="k-skeleton h-16 rounded-k-sm" />
        </div>
      </div>
    );
  }
  if (phase.kind === "error") {
    return (
      <div className="flex gap-3 border-l-2 border-danger pl-4">
        <Icon name="alert" className="mt-0.5 text-danger" />
        <p className="text-k-base leading-relaxed">{phase.message}</p>
      </div>
    );
  }
  const s = phase.summary;
  const stats: [string, number][] = [
    ["Shows", s.shows],
    ["Episodes", s.episodes],
    ["Ratings", s.ratings],
  ];
  if (s.movies > 0) stats.push(["Movies", s.movies]);
  if (s.lists > 0) stats.push(["Lists", s.lists]);
  return (
    <div className="k-enter-up">
      <p className="flex items-center gap-2 text-k-sm text-text-2">
        <Icon name="check" size={16} className="k-stamp text-success" strokeWidth={2.25} />
        Read <span className="font-semibold text-text">{phase.label}</span> in{" "}
        <span className="k-tabular">{s.ms} ms</span>. Nothing uploaded.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-k-sm border border-line bg-line">
        {stats.slice(0, 3).map(([k, v]) => (
          <div key={k} className="bg-surface px-3 py-3">
            <dt className="k-slate text-text-3">{k}</dt>
            <dd className="k-tabular mt-1 font-display text-k-xl font-medium tracking-[-0.02em]">{v.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
      {s.first !== undefined && s.last !== undefined && (
        <p className="mt-4 text-k-sm text-text-2">
          History from <span className="k-tabular text-text">{fmtDate(s.first)}</span> to{" "}
          <span className="k-tabular text-text">{fmtDate(s.last)}</span>
          {stats.length > 3 && <> · {stats.slice(3).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ")}</>}
        </p>
      )}
      {s.top.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {s.top.map((t) => (
            <li key={t.title} className="flex items-baseline justify-between gap-3 py-2">
              <i className="truncate font-display text-k-md">{t.title}</i>
              <span className="k-tabular k-slate shrink-0 text-text-3">{t.count} ep</span>
            </li>
          ))}
        </ul>
      )}
      {s.warnings > 0 && (
        <p className="mt-3 text-k-xs text-text-3">
          {s.warnings} note{s.warnings === 1 ? "" : "s"} about rows that were skipped or kept without a date.
        </p>
      )}
      <Link href={IMPORT_HREF} className={buttonClasses("primary", "md", "mt-5")}>
        Import this for real
        <Icon name="chevron-right" />
      </Link>
    </div>
  );
}
