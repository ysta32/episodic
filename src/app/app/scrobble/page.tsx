"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Icon,
  LoadingRegion,
  Skeleton,
  ToastProvider,
  useToast,
} from "@/components/ui";
import { db } from "@/lib/db";
import { follow, markMovieWatched, markWatched, watchId } from "@/lib/library";
import { clientProvider } from "@/lib/meta";

interface ScrobbleResult {
  title: string;
  detail: string;
  watchId: string;
  added: boolean;
}

async function recordScrobble(query: string): Promise<ScrobbleResult> {
  const params = new URLSearchParams(query);
  const kind = params.get("kind");
  const title = params.get("title")?.trim();
  if (
    !title ||
    title.length > 500 ||
    (kind !== "episode" && kind !== "movie" && kind !== "show")
  ) {
    throw new Error(
      "This watch link is incomplete. Open it again from your extension with a title and media kind.",
    );
  }
  const isEpisode = kind !== "movie";
  const seasonText = params.get("season") ?? "";
  const episodeText = params.get("episode") ?? "";
  const season = Number(seasonText);
  const episode = Number(episodeText);
  if (
    isEpisode &&
    (!/^\d+$/.test(seasonText) ||
      !/^\d+$/.test(episodeText) ||
      !Number.isSafeInteger(season) ||
      !Number.isSafeInteger(episode) ||
      episode < 1)
  ) {
    throw new Error(
      "This watch link needs a season and episode number. Open it again from your extension.",
    );
  }
  const provider = clientProvider();
  let id: string | null;
  let mediaId: string;
  try {
    id = await provider.resolve(isEpisode ? "show" : "movie", {}, title);
    if (!id) throw new Error("unresolved");
    if (isEpisode) {
      const [episodes] = await Promise.all([
        provider.getEpisodes(id),
        provider.getShow(id),
      ]);
      const match = episodes.find(
        (item) => item.season === season && item.number === episode,
      );
      if (!match) throw new Error("missing episode");
      mediaId = match.id;
    } else {
      await provider.getMovie(id);
      mediaId = id;
    }
  } catch {
    throw new Error(
      "Couldn't match this title or episode. Your watch history is unchanged. Check the link and your connection, then retry.",
    );
  }
  const database = db();
  const at = Date.now();
  const eventId = watchId(isEpisode ? "episode" : "movie", mediaId, at);
  const added = await database.transaction(
    "rw",
    [database.library, database.watches, database.episodes],
    async () => {
      if (await database.watches.get(eventId)) return false;
      if (!(await database.library.get(id))) {
        await follow({ id, kind: isEpisode ? "show" : "movie", title });
      }
      if (isEpisode) await markWatched([mediaId], at);
      else await markMovieWatched(mediaId, at);
      await database.watches.update(eventId, { source: "scrobble" });
      return true;
    },
  );
  return {
    title,
    detail: isEpisode ? `S${season} · E${episode}` : "Film",
    watchId: eventId,
    added,
  };
}

function ScrobbleLoading() {
  return (
    <LoadingRegion label="Matching your watch" className="space-y-4">
      <Skeleton delay={120} className="h-8 w-3/4" />
      <Skeleton delay={120} className="h-14 w-full" />
      <p className="text-text-2">Matching your title and saving this watch…</p>
    </LoadingRegion>
  );
}

function Receiver({ query }: { query: string }) {
  const { toast } = useToast();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ScrobbleResult | null>(null);
  const [error, setError] = useState("");
  const [undone, setUndone] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const operation = useRef<{
    attempt: number;
    promise: Promise<ScrobbleResult>;
  } | null>(null);
  const announced = useRef<Promise<ScrobbleResult> | null>(null);
  const undoLock = useRef(false);
  const undoneWatch = useRef<string | null>(null);

  const undo = useCallback(async (saved: ScrobbleResult) => {
    if (
      !saved.added ||
      undoLock.current ||
      undoneWatch.current === saved.watchId
    )
      return;
    undoLock.current = true;
    setUndoing(true);
    setError("");
    try {
      await db().watches.delete(saved.watchId);
      undoneWatch.current = saved.watchId;
      setUndone(true);
    } catch {
      setError("Couldn't undo this watch. It's still saved. Try Undo again.");
    } finally {
      undoLock.current = false;
      setUndoing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!operation.current || operation.current.attempt !== attempt) {
      operation.current = { attempt, promise: recordScrobble(query) };
    }
    const pending = operation.current.promise;
    void pending
      .then((saved) => {
        if (!active) return;
        setResult(saved);
        if (saved.added && announced.current !== pending) {
          announced.current = pending;
          toast({
            title: `Marked ${saved.title} · ${saved.detail} watched.`,
            tone: "success",
            duration: 6000,
            undo: () => void undo(saved),
          });
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Couldn't save this watch. Your history is safe. Retry when browser storage is available.",
          );
      });
    return () => {
      active = false;
    };
  }, [query, attempt, toast, undo]);

  return (
    <Card className="space-y-5">
      {!result && !error && <ScrobbleLoading />}
      {result && (
        <>
          <Icon
            name={undone ? "undo" : "check"}
            size={32}
            className="text-success"
          />
          <h1 className="font-display text-k-2xl">
            {undone
              ? "Watch undone"
              : result.added
                ? "Added to your history"
                : "Already in your history"}
          </h1>
          <p className="break-words text-k-lg">
            <i>{result.title}</i>{" "}
            <span className="k-slate text-text-2">{result.detail}</span>
          </p>
          <p role="status" className="text-text-2">
            {undone
              ? "This watch was removed. The title stays in your library."
              : "Saved on this device. You can return to what you were watching."}
          </p>
          {result.added && !undone && (
            <Button
              size="lg"
              variant="secondary"
              leadingIcon="undo"
              loading={undoing}
              disabled={undoing}
              onClick={() => void undo(result)}
            >
              Undo watch
            </Button>
          )}
        </>
      )}
      {error && (
        <div
          role="alert"
          className="space-y-4 rounded-k-md border border-danger p-4"
        >
          <p className="text-danger">{error}</p>
          {!result && (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center text-accent-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Return to your library
      </Link>
    </Card>
  );
}

function ScrobbleQuery() {
  const params = useSearchParams();
  const query = params.toString();
  return <Receiver key={query} query={query} />;
}

export default function ScrobblePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-bg px-4 py-12 text-text sm:px-6">
      <ToastProvider>
        <Suspense fallback={<ScrobbleLoading />}>
          <ScrobbleQuery />
        </Suspense>
      </ToastProvider>
    </main>
  );
}
