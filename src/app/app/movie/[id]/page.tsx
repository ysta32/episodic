"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatAirdate } from "@/components/app/EpisodeRow";
import { InlineNotice, MediaHero, MediaHeroSkeleton } from "@/components/app/Poster";
import {
  clearRating,
  decodeId,
  errorMessage,
  meta,
  restoreWatches,
  useOnline,
  useRefresh,
  watchesFor,
} from "@/components/app/useMeta";
import {
  Badge,
  Button,
  buttonClasses,
  cx,
  EmptyState,
  Icon,
  IconButton,
  LoadingRegion,
  Rating,
  useToast,
} from "@/components/ui";
import { db } from "@/lib/db";
import { follow, markMovieWatched, rate, setStatus, unfollow, unmarkWatched } from "@/lib/library";
import type { LibraryEntry, TrackStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TrackStatus; label: string }[] = [
  { value: "watchlist", label: "Watchlist" },
  { value: "completed", label: "Watched" },
  { value: "paused", label: "Paused" },
  { value: "dropped", label: "Dropped" },
];

function formatWatched(at: number): string {
  if (!at) return "Date unknown";
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MoviePage() {
  const params = useParams<{ id: string }>();
  const id = decodeId(params?.id);
  const router = useRouter();
  const { toast } = useToast();
  const online = useOnline();

  const movie = useLiveQuery(async () => (await db().movies.get(id)) ?? null, [id]);
  const entry = useLiveQuery(async () => (await db().library.get(id)) ?? null, [id]);
  const ratingRow = useLiveQuery(async () => (await db().ratings.get(`movie:${id}`)) ?? null, [id]);
  const watches = useLiveQuery(() => db().watches.where("mediaId").equals(id).toArray(), [id]);

  // "imdb:tt…" ids are unresolved imports; there's nothing to fetch, so the page renders from the library row.
  const load = useCallback(() => (id.startsWith("imdb:") ? Promise.resolve(null) : meta().getMovie(id)), [id]);
  const { state, retry } = useRefresh(id, load);

  const [optimisticWatched, setOptimisticWatched] = useState<boolean | null>(null);
  const baseWatched = (watches?.length ?? 0) > 0;
  useEffect(() => {
    setOptimisticWatched((prev) => (prev === baseWatched ? null : prev));
  }, [baseWatched]);
  const isWatched = optimisticWatched ?? baseWatched;

  const title = movie?.title ?? entry?.title ?? "";
  useEffect(() => {
    if (title) document.title = `${title} | Episodic`;
  }, [title]);

  const fetching = state.status === "idle" || state.status === "loading";
  const back = (
    <IconButton
      icon="chevron-left"
      label="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/app"))}
      className="-ml-2.5"
    />
  );

  if (movie === undefined || entry === undefined || (movie === null && !entry && fetching)) {
    return (
      <LoadingRegion label="Loading film" className="flex flex-col gap-8">
        {back}
        <MediaHeroSkeleton />
      </LoadingRegion>
    );
  }

  if (movie === null && !entry) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        {state.status === "error" ? (
          <EmptyState
            icon={online ? "alert" : "offline"}
            title={online ? "Couldn't reach TMDB" : "This film isn't saved on this device yet"}
            action={
              <Button onClick={retry} leadingIcon="undo" disabled={!online}>
                Retry
              </Button>
            }
          >
            {online
              ? "Your library is fine. Film details come from TMDB, which may be busy or not connected on this server."
              : "You're offline. We'll load it as soon as you're back online."}
          </EmptyState>
        ) : (
          <EmptyState
            icon="search"
            title="We couldn't find this film"
            action={
              <Link href="/app/discover" className={buttonClasses("primary")}>
                Search Discover
              </Link>
            }
          >
            The link may be out of date, or TMDB no longer lists it.
          </EmptyState>
        )}
      </div>
    );
  }

  const name = title || id;

  const markWatchedNow = async () => {
    setOptimisticWatched(true);
    try {
      if (!entry) await follow({ id, kind: "movie", title: name, ids: movie?.ids, status: "completed" });
      await markMovieWatched(id);
    } catch (cause) {
      setOptimisticWatched(null);
      toast({ tone: "danger", title: `Couldn't mark ${name} watched. Nothing changed.`, description: errorMessage(cause) });
    }
  };

  const unmark = async () => {
    setOptimisticWatched(false);
    try {
      const previous = await watchesFor([id]);
      await unmarkWatched(id);
      toast({
        title: `Marked ${name} unwatched.`,
        undo: () => {
          restoreWatches(previous).catch((cause: unknown) =>
            toast({ tone: "danger", title: "Couldn't restore your watch.", description: errorMessage(cause) }),
          );
        },
      });
    } catch (cause) {
      setOptimisticWatched(null);
      toast({ tone: "danger", title: `Couldn't unmark ${name}. Your history is unchanged.`, description: errorMessage(cause) });
    }
  };

  const onWatchlist = async () => {
    try {
      await follow({ id, kind: "movie", title: name, ids: movie?.ids, status: "watchlist" });
    } catch (cause) {
      toast({ tone: "danger", title: `Couldn't add ${name}. Nothing changed.`, description: errorMessage(cause) });
    }
  };

  const onStatus = async (status: TrackStatus) => {
    try {
      await setStatus(id, status);
    } catch (cause) {
      toast({ tone: "danger", title: "Couldn't change the status.", description: errorMessage(cause) });
    }
  };

  const onRemove = async (prev: LibraryEntry) => {
    try {
      await unfollow(prev.id);
      toast({
        title: `Removed ${prev.title} from your library. Your watch history stays.`,
        undo: () => {
          db()
            .library.put(prev)
            .catch((cause: unknown) => toast({ tone: "danger", title: "Couldn't restore it.", description: errorMessage(cause) }));
        },
      });
    } catch (cause) {
      toast({ tone: "danger", title: `Couldn't remove ${prev.title}.`, description: errorMessage(cause) });
    }
  };

  const onRate = async (stars: number) => {
    try {
      if (stars === 0) await clearRating("movie", id);
      else await rate("movie", id, Math.round(stars * 2));
    } catch (cause) {
      toast({ tone: "danger", title: "Couldn't save your rating.", description: errorMessage(cause) });
    }
  };

  const ratingValue = (ratingRow?.rating ?? entry?.rating ?? 0) / 2;
  const release = formatAirdate(movie?.releaseDate);
  const year = movie?.year;
  const history = [...(watches ?? [])].sort((a, b) => b.watchedAt - a.watchedAt);
  const statusOptions = entry && !STATUS_OPTIONS.some((o) => o.value === entry.status)
    ? [...STATUS_OPTIONS, { value: entry.status, label: "Watching" }]
    : STATUS_OPTIONS;

  return (
    <div className="flex flex-col gap-8">
      {back}

      {state.status === "error" && movie && (
        <InlineNotice
          tone="info"
          icon={online ? "alert" : "offline"}
          action={
            online ? (
              <Button variant="secondary" size="sm" onClick={retry}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {online
            ? "Couldn't refresh from TMDB. You're seeing the copy saved on this device."
            : "Offline. You're seeing the copy saved on this device, and changes save locally."}
        </InlineNotice>
      )}
      {!movie && entry && !fetching && (
        <InlineNotice tone="info" icon="info">
          We only have the title for this one, from your import. Details appear once it matches a TMDB entry.
        </InlineNotice>
      )}

      <MediaHero
        title={name}
        year={year}
        poster={movie?.poster}
        summary={movie?.summary}
        eyebrow={
          <>
            <span>Film</span>
            {year && <><span aria-hidden>·</span><span className="k-tabular">{year}</span></>}
            {movie?.runtime ? <><span aria-hidden>·</span><span className="k-tabular">{movie.runtime} min</span></> : null}
          </>
        }
        meta={
          <>
            {release && <Badge tone="outline">Released {release}</Badge>}
            {isWatched && (
              <Badge tone="success">
                <Icon name="check" />
                Watched
              </Badge>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {isWatched ? (
              <Button variant="secondary" leadingIcon="undo" onClick={() => void unmark()} className="min-h-11 sm:min-h-10">
                Mark unwatched
              </Button>
            ) : (
              <Button leadingIcon="check" onClick={() => void markWatchedNow()} className="min-h-11 sm:min-h-10">
                Mark watched
              </Button>
            )}
            {entry ? (
              <>
                <label className="relative inline-flex">
                  <span className="sr-only">Status for {name}</span>
                  <select
                    value={entry.status}
                    onChange={(e) => void onStatus(e.target.value as TrackStatus)}
                    className={cx(buttonClasses("secondary", "md"), "min-h-11 appearance-none pl-4 pr-9 sm:min-h-10")}
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-3" />
                </label>
                <Button variant="ghost" onClick={() => void onRemove(entry)} className="min-h-11 sm:min-h-10">
                  Remove
                </Button>
              </>
            ) : (
              <Button variant="secondary" leadingIcon="plus" onClick={() => void onWatchlist()} className="min-h-11 sm:min-h-10">
                Watchlist
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-k-sm font-semibold uppercase tracking-[0.06em] text-text-3">Your rating</span>
            <Rating value={ratingValue} onChange={(v) => void onRate(v)} label={`Your rating for ${name}`} size={24} />
          </div>
        </div>
      </MediaHero>

      {history.length > 0 && (
        <section aria-labelledby="diary-h" className="flex max-w-xl flex-col gap-2">
          <h2 id="diary-h" className="text-k-sm font-semibold uppercase tracking-[0.06em] text-text-3">
            Your diary
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {history.map((w) => (
              <li key={w.id} className="flex h-12 items-center gap-3 text-k-base">
                <Icon name="check" size={18} className="text-success" />
                <span className="flex-1 text-text">{formatWatched(w.watchedAt)}</span>
                <span className="k-slate text-text-3">{w.source === "manual" ? "Logged here" : `Imported · ${w.source}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
