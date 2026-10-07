"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { ActionLink } from "@/components/app/EmptyState";
import { ShowPoster } from "@/components/app/ShowPoster";
import { EmptyState, LoadingRegion, ProgressBar, Segmented, Skeleton, Tabs, type TabItem } from "@/components/ui";
import { db } from "@/lib/db";
import { progress } from "@/lib/library";
import type { LibraryEntry, TrackStatus } from "@/lib/types";

type Sort = "recent" | "title" | "rating" | "progress";
type TabId = TrackStatus | "movies";

const tabs: ReadonlyArray<{ id: TabId; label: string; empty: string }> = [
  { id: "watching", label: "Watching", empty: "Shows you're partway through live here." },
  { id: "watchlist", label: "Watchlist", empty: "Save shows you mean to start." },
  { id: "completed", label: "Completed", empty: "Finished shows land here." },
  { id: "paused", label: "Paused", empty: "Shows you've set down for now." },
  { id: "dropped", label: "Dropped", empty: "Shows you've given up on." },
  { id: "movies", label: "Movies", empty: "Films you've watched or saved." },
];

interface Row {
  entry: LibraryEntry;
  poster?: string;
  pct: number;
  watched: number;
  aired: number;
}

function LibrarySkeleton() {
  return (
    <LoadingRegion label="Loading your library" className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton delay={120} className="aspect-[2/3] w-full" />
          <Skeleton delay={120} className="h-3 w-4/5" />
          <Skeleton delay={120} className="h-1 w-full" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export default function LibraryPage() {
  const [sort, setSort] = useState<Sort>("recent");
  const rows = useLiveQuery(async (): Promise<Row[]> => {
    const d = db();
    const entries = await d.library.toArray();
    const [shows, movies] = await Promise.all([
      d.shows.bulkGet(entries.filter((e) => e.kind === "show").map((e) => e.id)),
      d.movies.bulkGet(entries.filter((e) => e.kind === "movie").map((e) => e.id)),
    ]);
    const posters = new Map<string, string | undefined>();
    [...shows, ...movies].forEach((m) => m && posters.set(m.id, m.poster));
    return Promise.all(
      entries.map(async (entry) => {
        const p = entry.kind === "show" ? await progress(entry.id) : { watched: 0, aired: 0, pct: entry.status === "completed" ? 100 : 0 };
        return { entry, poster: posters.get(entry.id), ...p };
      }),
    );
  });

  if (rows === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="mb-6 font-display text-k-2xl font-medium tracking-[-0.02em]">Library</h1>
        <LibrarySkeleton />
      </div>
    );
  }

  const inTab = (id: TabId) => rows.filter((r) => (id === "movies" ? r.entry.kind === "movie" : r.entry.kind === "show" && r.entry.status === id));
  const sorted = (list: Row[]) =>
    list.slice().sort((a, b) => {
      switch (sort) {
        case "title":
          return a.entry.title.localeCompare(b.entry.title);
        case "rating":
          return (b.entry.rating ?? 0) - (a.entry.rating ?? 0) || a.entry.title.localeCompare(b.entry.title);
        case "progress":
          return b.pct - a.pct || a.entry.title.localeCompare(b.entry.title);
        default:
          return b.entry.updatedAt - a.entry.updatedAt;
      }
    });

  const items: TabItem[] = tabs.map((t) => {
    const list = sorted(inTab(t.id));
    return {
      id: t.id,
      label: t.label,
      count: list.length,
      content:
        list.length === 0 ? (
          <EmptyState icon="library" title={`Nothing in ${t.label.toLowerCase()} yet`} action={<ActionLink href="/app/discover">Find something to add</ActionLink>}>
            {t.empty}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-4 gap-y-6">
            {list.map(({ entry, poster, pct, watched, aired }) => (
              <li key={entry.id}>
                <Link
                  href={`/app/${entry.kind}/${encodeURIComponent(entry.id)}`}
                  className="group flex flex-col gap-2 rounded-k-sm"
                >
                  <ShowPoster src={poster} title={entry.title} className="transition-transform duration-(--k-dur-2) ease-k-out group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0" />
                  <span className="line-clamp-2 font-display text-k-base font-medium italic leading-tight">{entry.title}</span>
                  {entry.kind === "show" ? (
                    <>
                      <ProgressBar
                        value={pct}
                        label={`${entry.title} progress`}
                        valueText={`${watched} of ${aired} episodes`}
                        tone={pct === 100 ? "success" : "accent"}
                      />
                      <span className="k-slate k-tabular text-text-3">{aired ? `${watched} / ${aired} eps` : "No episodes yet"}</span>
                    </>
                  ) : (
                    entry.rating !== undefined && <span className="k-slate k-tabular text-text-3">{entry.rating}/10</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ),
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-k-2xl font-medium tracking-[-0.02em]">Library</h1>
        <Segmented<Sort>
          label="Sort by"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Recent" },
            { value: "title", label: "Title" },
            { value: "rating", label: "Rating" },
            { value: "progress", label: "Progress" },
          ]}
        />
      </header>
      {rows.length === 0 ? (
        <EmptyState
          icon="library"
          title="Your library is empty"
          action={<ActionLink href="/app/import?source=tvtime">Bring your TV Time history</ActionLink>}
          secondary={<ActionLink href="/app/discover" variant="secondary">Start fresh</ActionLink>}
        >
          Everything you follow, watch or rate shows up here, stored on this device.
        </EmptyState>
      ) : (
        <Tabs label="Library sections" items={items} defaultValue={items.find((i) => (i.count ?? 0) > 0)?.id ?? "watching"} />
      )}
    </div>
  );
}
