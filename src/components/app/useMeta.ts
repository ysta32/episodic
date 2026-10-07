"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/lists";
import { clientProvider } from "@/lib/meta";
import type { MetadataProvider, SearchResult } from "@/lib/meta/types";
import type { Settings, WatchEvent } from "@/lib/types";

let provider: MetadataProvider | null = null;
/** One shared client metadata provider, so in-flight requests are de-duplicated across components. */
export function meta(): MetadataProvider {
  provider ??= clientProvider();
  return provider;
}

/** Route params arrive URL-encoded ("tvmaze%3A123"); decode once, tolerating already-decoded or malformed input. */
export function decodeId(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Path to a show or movie page; ids contain ":" so they are always encoded. */
export function mediaHref(kind: "show" | "movie", id: string): string {
  return `/app/${kind}/${encodeURIComponent(id)}`;
}

export function episodeHref(id: string): string {
  return `/app/episode/${encodeURIComponent(id)}`;
}

/** "S02 · E05" broadcast slate label. */
export function slate(season: number, number: number): string {
  return `S${String(season).padStart(2, "0")} · E${String(number).padStart(2, "0")}`;
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

// ---------------------------------------------------------------------------
// connectivity

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** True while the browser reports a connection. Server render assumes online to avoid a false offline flash. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

// ---------------------------------------------------------------------------
// settings

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), []);
}

// ---------------------------------------------------------------------------
// remote refresh, cache first

export type FetchState = { status: "idle" | "loading" | "done" } | { status: "error"; message: string };

/**
 * Run `load` on mount, whenever `key` changes, and again when the browser comes back online after a failure.
 * The data itself is read from IndexedDB via useLiveQuery by the caller, so cached rows render immediately and
 * this only reports whether a refresh is in flight or failed.
 */
export function useRefresh(key: string, load: () => Promise<unknown>): { state: FetchState; retry: () => void } {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setState({ status: "loading" });
    loadRef.current().then(
      () => {
        if (!cancelled) setState({ status: "done" });
      },
      (cause: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorMessage(cause) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const failed = state.status === "error";
  useEffect(() => {
    if (!failed) return;
    const onOnline = () => setAttempt((n) => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [failed]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}

// ---------------------------------------------------------------------------
// search

export type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string; /** Last settled results, kept on screen while the next query runs. */ previous?: SearchResult[] }
  | { status: "done"; query: string; results: SearchResult[] }
  | { status: "error"; query: string; message: string };

/** Debounced metadata search. Queries shorter than 2 characters stay idle. */
export function useSearch(query: string, delay = 280): { state: SearchState; retry: () => void } {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState((prev) => {
      if (prev.status === "done" && prev.query === q) return prev;
      const previous = prev.status === "done" ? prev.results : prev.status === "loading" ? prev.previous : undefined;
      return { status: "loading", query: q, previous };
    });
    const timer = window.setTimeout(() => {
      meta()
        .search(q)
        .then(
          (results) => {
            if (!cancelled) setState({ status: "done", query: q, results });
          },
          (cause: unknown) => {
            if (!cancelled) setState({ status: "error", query: q, message: errorMessage(cause) });
          },
        );
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, delay, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}

// ---------------------------------------------------------------------------
// writes that the library engine does not cover

/** Remove a show/movie rating (the Rating control clears on a second click of the same star). */
export async function clearRating(kind: "show" | "movie", mediaId: string): Promise<void> {
  const d = db();
  await d.transaction("rw", d.ratings, d.library, async () => {
    await d.ratings.delete(`${kind}:${mediaId}`);
    await d.library.update(mediaId, { rating: undefined, updatedAt: Date.now() });
  });
}

/** Watch rows for a media id, so an unmark can be undone with the original dates and sources intact. */
export async function watchesFor(mediaIds: string[]): Promise<WatchEvent[]> {
  if (!mediaIds.length) return [];
  return db().watches.where("mediaId").anyOf(mediaIds).toArray();
}

export async function restoreWatches(rows: WatchEvent[]): Promise<void> {
  if (rows.length) await db().watches.bulkPut(rows);
}
