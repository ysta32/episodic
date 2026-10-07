"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CommandPalette,
  EmptyState,
  Icon,
  LoadingRegion,
  ProgressBar,
  Skeleton,
} from "@/components/ui";
import { db } from "@/lib/db";
import { IMPORTERS } from "@/lib/import";
import type { ImportBundle, InputFile } from "@/lib/import/types";
import { expandZips } from "@/lib/import/zip";
import { applyImport, type ApplyImportResult } from "@/lib/library";
import { clientProvider } from "@/lib/meta";
import type { ImportSource } from "@/lib/types";

const sources: ImportSource[] = [
  "tvtime",
  "trakt",
  "simkl",
  "letterboxd",
  "imdb",
  "csv",
  "episodic",
];
const focusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

export default function ImportWizard({
  initialSource = "tvtime",
}: {
  initialSource?: ImportSource;
}) {
  const [source, setSource] = useState(initialSource);
  const [files, setFiles] = useState<File[]>([]);
  const [bundle, setBundle] = useState<ImportBundle | null>(null);
  const [result, setResult] = useState<ApplyImportResult | null>(null);
  const [phase, setPhase] = useState<
    "choose" | "parsing" | "preview" | "importing" | "done"
  >("choose");
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [offline, setOffline] = useState(false);
  const [dragging, setDragging] = useState(false);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const unresolved = useRef<HTMLTextAreaElement>(null);
  const library = useLiveQuery(async () => {
    try {
      return { count: await db().library.count(), error: false };
    } catch {
      return { count: 0, error: true };
    }
  });
  const busy = phase === "parsing" || phase === "importing";

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  function choose(next: ImportSource) {
    if (locked.current) return;
    setSource(next);
    setFiles([]);
    setBundle(null);
    setResult(null);
    setPhase("choose");
    setError("");
    setCopyMessage("");
    if (input.current) input.current.value = "";
  }

  async function parse(selected: File[]) {
    if (locked.current || !selected.length) return;
    locked.current = true;
    setFiles(selected);
    setBundle(null);
    setResult(null);
    setError("");
    setCopyMessage("");
    setPhase("parsing");
    try {
      if (selected.some((file) => !/\.(zip|csv|json)$/i.test(file.name))) {
        throw new Error("Choose ZIP, CSV, or JSON files from your export.");
      }
      const wrapped: InputFile[] = selected.map((file) => ({
        name: file.name,
        text: () => file.text(),
        bytes: async () => new Uint8Array(await file.arrayBuffer()),
      }));
      const importer = await IMPORTERS[source].load();
      const parsed = await importer(await expandZips(wrapped));
      setBundle(parsed);
      setPhase("preview");
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : "Couldn't read these files."} Your library is unchanged. Retry or choose another export.`,
      );
      setPhase("choose");
    } finally {
      locked.current = false;
    }
  }

  async function importHistory() {
    if (!bundle || locked.current) return;
    if (!navigator.onLine) {
      setError(
        "You're offline. Your preview is ready; reconnect, then retry the import to match your titles.",
      );
      return;
    }
    locked.current = true;
    setPhase("importing");
    setError("");
    setProgress({ done: 0, total: 1 });
    try {
      const imported = await applyImport(
        bundle,
        clientProvider(),
        (done, total) => setProgress({ done, total }),
      );
      setResult(imported);
      setPhase("done");
    } catch {
      setError(
        "Couldn't save your import. Your existing history is safe. Retry the import; duplicate watches won't be added.",
      );
      setPhase("preview");
    } finally {
      locked.current = false;
    }
  }

  async function copyTitles() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.unresolved.join("\n"));
      setCopyMessage("Unresolved titles copied.");
    } catch {
      unresolved.current?.focus();
      unresolved.current?.select();
      setCopyMessage(
        "Copy wasn't available. The titles are selected so you can copy them manually.",
      );
    }
  }

  const empty =
    bundle &&
    !bundle.items.length &&
    !bundle.watches.length &&
    !bundle.episodeRatings.length &&
    !bundle.lists.length;
  const summary = bundle
    ? ([
        ["Shows", bundle.items.filter((item) => item.kind === "show").length],
        ["Movies", bundle.items.filter((item) => item.kind === "movie").length],
        [
          "Episodes watched",
          bundle.watches.filter((watch) => watch.kind === "episode").length,
        ],
        [
          "Movie watches",
          bundle.watches.filter((watch) => watch.kind === "movie").length,
        ],
        [
          "Ratings",
          bundle.items.filter((item) => item.rating !== undefined).length +
            bundle.episodeRatings.length,
        ],
        ["Lists", bundle.lists.length],
      ] as const)
    : [];

  return (
    <section aria-labelledby="import-heading" className="space-y-6">
      <header className="space-y-3">
        <p className="k-slate text-accent-ink">Your next chapter</p>
        <h1 id="import-heading" className="font-display text-k-3xl">
          Bring your history
        </h1>
        <p className="max-w-[68ch] text-text-2">
          Your file never leaves your device. Only titles and IDs are sent for
          metadata lookup when you import.
        </p>
        {library?.count === 0 && !library.error && (
          <p className="text-text-2">
            Start with the shows and films you already know.
          </p>
        )}
        <Link
          href="/app"
          className={`inline-flex min-h-11 items-center text-accent-ink underline underline-offset-4 ${focusClass}`}
        >
          {library?.count ? "Back to your library" : "Start fresh"}
        </Link>
      </header>
      {offline && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-k-pill bg-surface-2 px-4 py-3 text-k-sm text-text-2"
        >
          <Icon name="offline" />
          Offline · preview files and export locally. Reconnect to match titles.
        </p>
      )}
      {library?.error && (
        <p
          role="alert"
          className="rounded-k-sm border border-danger p-4 text-danger"
        >
          Couldn’t open your local library. Allow browser storage, then reload
          this page.
        </p>
      )}
      <fieldset disabled={busy} className="space-y-3">
        <legend className="mb-3 font-semibold">1. Choose your source</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((key) => (
            <label
              key={key}
              className={`relative flex min-h-20 cursor-pointer items-center gap-3 rounded-k-md border p-4 ${source === key ? "border-accent bg-surface-2" : "border-line bg-surface"} ${key === "tvtime" ? "sm:col-span-2 lg:col-span-3" : ""}`}
            >
              <input
                type="radio"
                name="import-source"
                value={key}
                checked={source === key}
                onChange={() => choose(key)}
                className={`size-5 accent-accent ${focusClass}`}
              />
              <span className="flex-1 font-semibold">
                {IMPORTERS[key].label}
                {key === "tvtime" && (
                  <span className="mt-1 block text-k-sm font-normal text-text-2">
                    Pick up where you left off.
                  </span>
                )}
              </span>
              {source === key && (
                <Icon name="check" className="text-accent-ink" />
              )}
            </label>
          ))}
        </div>
      </fieldset>
      <Card className="space-y-4">
        <h2 className="font-semibold">2. Choose your files</h2>
        <p id="source-help" className="max-w-[68ch] text-k-sm text-text-2">
          {IMPORTERS[source].help}
        </p>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) void parse(Array.from(event.dataTransfer.files));
          }}
          className={`space-y-3 rounded-k-md border border-dashed p-5 ${dragging ? "border-accent bg-surface-2" : "border-line-strong"}`}
        >
          <label
            htmlFor="import-files"
            className="flex items-center gap-2 font-semibold"
          >
            <Icon name="import" />
            Drop files here, or choose files
          </label>
          <input
            ref={input}
            id="import-files"
            type="file"
            multiple
            accept={IMPORTERS[source].accept}
            disabled={busy}
            aria-describedby="source-help"
            className={`min-h-11 w-full min-w-0 rounded-k-sm text-k-sm file:mr-3 file:min-h-11 file:rounded-k-sm file:border-0 file:bg-surface-2 file:px-3 file:text-text ${focusClass}`}
            onChange={(event) => {
              void parse(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          <p className="break-words text-k-sm text-text-2">
            {files.length
              ? files.map((file) => file.name).join(", ")
              : "ZIP, CSV, or JSON. You can select several files together."}
          </p>
        </div>
      </Card>
      {error && (
        <div
          role="alert"
          className="space-y-3 rounded-k-md border border-danger p-4"
        >
          <p className="text-danger">{error}</p>
          <Button
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={() => void (bundle ? importHistory() : parse(files))}
          >
            Retry
          </Button>
        </div>
      )}
      {phase === "parsing" && (
        <LoadingRegion
          label="Reading your files locally"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} delay={120} className="h-20" />
          ))}
        </LoadingRegion>
      )}
      {bundle && phase !== "done" && (
        <Card className="space-y-5">
          <h2 className="font-display text-k-xl">3. Review your history</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {summary.map(([label, count]) => (
              <div key={label}>
                <dt className="text-k-sm text-text-2">{label}</dt>
                <dd className="k-tabular text-k-xl">{count}</dd>
              </div>
            ))}
          </dl>
          {bundle.warnings.length > 0 && (
            <details className="rounded-k-sm bg-surface-2 p-3">
              <summary className={`min-h-11 cursor-pointer py-2 ${focusClass}`}>
                {bundle.warnings.length} warnings to review
              </summary>
              <ul className="list-disc space-y-2 break-words pl-5 text-k-sm text-text-2">
                {bundle.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          {empty ? (
            <EmptyState
              icon="import"
              title="No history found in these files"
              action={
                <Button size="lg" onClick={() => input.current?.click()}>
                  Choose another file
                </Button>
              }
            >
              Check the source and try another export.
            </EmptyState>
          ) : (
            <>
              <p className="text-k-sm text-text-2">
                This merges with your library. Existing ratings and statuses may
                be updated. Download a backup below before importing.
              </p>
              <Button
                size="lg"
                leadingIcon="import"
                disabled={busy || offline || library?.error}
                loading={phase === "importing"}
                onClick={() => void importHistory()}
              >
                Import
              </Button>
            </>
          )}
        </Card>
      )}
      {phase === "importing" && (
        <div role="status" className="space-y-3">
          <p className="text-text-2">
            Matching titles and saving your history… Keep this page open.
          </p>
          <ProgressBar
            value={progress.done}
            max={progress.total}
            label="Import progress"
            valueText={`${progress.done} of ${progress.total} metadata steps`}
            size="md"
          />
        </div>
      )}
      {result && phase === "done" && (
        <Card className="space-y-5">
          <h2
            role="status"
            className="flex items-center gap-2 font-display text-k-xl"
          >
            <Icon name="check" className="text-success" />
            Import finished
          </h2>
          <p className="text-text-2">
            Added {result.added} titles and {result.watches} watches. Updated{" "}
            {result.ratings} ratings and {result.lists} lists.
          </p>
          {result.unresolved.length > 0 && (
            <div className="space-y-3">
              <label
                htmlFor="unresolved-titles"
                className="block font-semibold"
              >
                {result.unresolved.length} titles still need a match
              </label>
              <p className="text-k-sm text-text-2">
                These titles weren’t imported. Keep the list and retry when
                metadata is available.
              </p>
              <textarea
                ref={unresolved}
                id="unresolved-titles"
                readOnly
                value={result.unresolved.join("\n")}
                rows={Math.min(8, result.unresolved.length + 1)}
                className={`w-full rounded-k-sm border border-line bg-bg p-3 text-text ${focusClass}`}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => void copyTitles()}
                >
                  Copy unresolved titles
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  disabled={offline}
                  onClick={() => void importHistory()}
                >
                  Retry matching
                </Button>
              </div>
              <p role="status" className="text-k-sm text-text-2">
                {copyMessage}
              </p>
            </div>
          )}
          <Button size="lg" variant="secondary" onClick={() => choose(source)}>
            Import more files
          </Button>
        </Card>
      )}
      <CommandPalette
        commands={[
          ...sources.map((key) => ({
            id: `source-${key}`,
            label: `Import from ${IMPORTERS[key].label}`,
            group: "Import",
            disabled: busy,
            run: () => choose(key),
          })),
          {
            id: "choose-files",
            label: "Choose import files",
            group: "Import",
            disabled: busy,
            run: () => input.current?.click(),
          },
          {
            id: "export",
            label: "Export your history",
            group: "Your data",
            run: () => document.getElementById("export")?.scrollIntoView(),
          },
        ]}
      />
    </section>
  );
}
