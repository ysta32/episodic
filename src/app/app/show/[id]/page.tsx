"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EpisodeRow, EpisodeRowSkeleton } from "@/components/app/EpisodeRow";
import { InlineNotice, MediaHero, MediaHeroSkeleton } from "@/components/app/Poster";
import {
  clearRating,
  decodeId,
  errorMessage,
  meta,
  restoreWatches,
  slate,
  useOnline,
  useRefresh,
  useSettings,
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
  ProgressBar,
  Rating,
  Tabs,
  useToast,
  type TabItem,
} from "@/components/ui";
import { db } from "@/lib/db";
import { follow, isAired, markSeasonWatched, markWatched, rate, setStatus, unfollow, unmarkWatched } from "@/lib/library";
import type { Episode, LibraryEntry, Show, TrackStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TrackStatus; label: string }[] = [
  { value: "watching", label: "Watching" },
  { value: "watchlist", label: "Watchlist" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
];

const SHOW_STATUS: Record<NonNullable<Show["status"]>, { label: string; tone: "accent" | "neutral" | "info" }> = {
  running: { label: "Airing", tone: "accent" },
  ended: { label: "Ended", tone: "neutral" },
  tbd: { label: "To be determined", tone: "info" },
  unknown: { label: "Status unknown", tone: "neutral" },
};

const byOrder = (a: Episode, b: Episode) => a.season - b.season || a.number - b.number;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function ShowPage() {
  const params = useParams<{ id: string }>();
  const id = decodeId(params?.id);
  const router = useRouter();
  const { toast } = useToast();
  const online = useOnline();
  const settings = useSettings();

  // Local cache first: every read is a live IndexedDB query, so cached rows render instantly and offline.
  const show = useLiveQuery(async () => (await db().shows.get(id)) ?? null, [id]);
  const episodes = useLiveQuery(() => db().episodes.where("showId").equals(id).toArray(), [id]);
  const watches = useLiveQuery(() => db().watches.where("showId").equals(id).toArray(), [id]);
  const entry = useLiveQuery(async () => (await db().library.get(id)) ?? null, [id]);
  const ratingRow = useLiveQuery(async () => (await db().ratings.get(`show:${id}`)) ?? null, [id]);

  const load = useCallback(() => Promise.all([meta().getShow(id), meta().getEpisodes(id)]), [id]);
  const { state, retry } = useRefresh(id, load);

  useEffect(() => {
    if (show?.title) document.title = `${show.title} | Episodic`;
  }, [show?.title]);

  // Optimistic watched overrides; pruned once IndexedDB agrees.
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());
  const baseWatched = useMemo(() => new Set((watches ?? []).map((w) => w.mediaId)), [watches]);
  useEffect(() => {
    setOverrides((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map([...prev].filter(([k, v]) => baseWatched.has(k) !== v));
      return next.size === prev.size ? prev : next;
    });
  }, [baseWatched]);
  const watched = useMemo(() => {
    const s = new Set(baseWatched);
    for (const [k, v] of overrides) {
      if (v) s.add(k);
      else s.delete(k);
    }
    return s;
  }, [baseWatched, overrides]);

  const setOverride = useCallback((ids: string[], value: boolean | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const k of ids) {
        if (value === null) next.delete(k);
        else next.set(k, value);
      }
      return next;
    });
  }, []);

  // Pinned per visit so memoised lists stay stable; an episode airing mid-visit shows up on the next load.
  const [now] = useState(() => Date.now());
  const sorted = useMemo(() => [...(episodes ?? [])].sort(byOrder), [episodes]);
  const regular = useMemo(() => sorted.filter((e) => e.season > 0), [sorted]);
  const aired = useMemo(() => regular.filter((e) => isAired(e, now)), [regular, now]);
  const watchedAired = aired.filter((e) => watched.has(e.id)).length;
  const nextUp = useMemo(() => {
    let last = -1;
    regular.forEach((e, i) => {
      if (watched.has(e.id)) last = i;
    });
    const gaps = regular.filter((e) => isAired(e, now) && !watched.has(e.id));
    return gaps.find((e) => regular.indexOf(e) > last) ?? gaps[0];
  }, [regular, watched, now]);
  const remainingMinutes = aired
    .filter((e) => !watched.has(e.id))
    .reduce((sum, e) => sum + (e.runtime ?? show?.runtime ?? 0), 0);

  const seasons = useMemo(() => {
    const map = new Map<number, Episode[]>();
    for (const e of sorted) {
      const list = map.get(e.season);
      if (list) list.push(e);
      else map.set(e.season, [e]);
    }
    // Regular seasons first, specials (season 0) last.
    return [...map.entries()].sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
  }, [sorted]);

  const [season, setSeason] = useState<string | null>(null);
  const defaultSeason = String(nextUp?.season ?? seasons[0]?.[0] ?? "");
  const selectedSeason = season && seasons.some(([n]) => String(n) === season) ? season : defaultSeason;

  // ---- actions --------------------------------------------------------------

  const toggleEpisode = useCallback(
    async (ep: Episode, next: boolean) => {
      const label = slate(ep.season, ep.number);
      setOverride([ep.id], next);
      if (next) {
        try {
          await markWatched([ep.id]);
        } catch (cause) {
          setOverride([ep.id], null);
          toast({ tone: "danger", title: `Couldn't mark ${label} watched. Nothing changed.`, description: errorMessage(cause) });
        }
        return;
      }
      try {
        const previous = await watchesFor([ep.id]);
        await unmarkWatched(ep.id);
        toast({
          title: `Marked ${label} unwatched.`,
          undo: () => {
            restoreWatches(previous).catch((cause: unknown) =>
              toast({ tone: "danger", title: `Couldn't restore ${label}.`, description: errorMessage(cause) }),
            );
          },
        });
      } catch (cause) {
        setOverride([ep.id], null);
        toast({ tone: "danger", title: `Couldn't unmark ${label}. Your history is unchanged.`, description: errorMessage(cause) });
      }
    },
    [setOverride, toast],
  );

  const markSeason = useCallback(
    async (n: number, eps: Episode[]) => {
      const at = Date.now();
      const todo = eps.filter((e) => isAired(e, at) && !watched.has(e.id)).map((e) => e.id);
      if (!todo.length) return;
      setOverride(todo, true);
      const name = n === 0 ? "specials" : `Season ${n}`;
      try {
        const count = await markSeasonWatched(id, n, at);
        toast({
          tone: "success",
          title: `Marked ${count || todo.length} ${count === 1 ? "episode" : "episodes"} of ${name} watched.`,
          undo: () => {
            Promise.all(todo.map((e) => unmarkWatched(e))).catch((cause: unknown) =>
              toast({ tone: "danger", title: `Couldn't undo ${name}.`, description: errorMessage(cause) }),
            );
          },
        });
      } catch (cause) {
        setOverride(todo, null);
        toast({ tone: "danger", title: `Couldn't mark ${name} watched. Nothing changed.`, description: errorMessage(cause) });
      }
    },
    [id, watched, setOverride, toast],
  );

  const title = show?.title ?? entry?.title ?? "";

  const onFollow = async (status: TrackStatus) => {
    try {
      await follow({ id, kind: "show", title: title || id, ids: show?.ids, status });
    } catch (cause) {
      toast({ tone: "danger", title: `Couldn't add ${title}. Nothing changed.`, description: errorMessage(cause) });
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
      if (stars === 0) await clearRating("show", id);
      else await rate("show", id, Math.round(stars * 2));
    } catch (cause) {
      toast({ tone: "danger", title: "Couldn't save your rating.", description: errorMessage(cause) });
    }
  };

  // ---- states ---------------------------------------------------------------

  const fetching = state.status === "idle" || state.status === "loading";
  const back = (
    <IconButton
      icon="chevron-left"
      label="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/app"))}
      className="-ml-2.5"
    />
  );

  if (show === undefined || (show === null && fetching)) {
    return (
      <LoadingRegion label="Loading show" className="flex flex-col gap-8">
        {back}
        <MediaHeroSkeleton />
        <ul className="flex flex-col gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <EpisodeRowSkeleton key={i} />
          ))}
        </ul>
      </LoadingRegion>
    );
  }

  if (show === null) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        {state.status === "error" ? (
          <EmptyState
            icon={online ? "alert" : "offline"}
            title={online ? "Couldn't reach TVmaze" : "This show isn't saved on this device yet"}
            action={
              <Button onClick={retry} leadingIcon="undo" disabled={!online}>
                Retry
              </Button>
            }
            secondary={
              <Link href="/app" className={buttonClasses("ghost")}>
                Back to Up Next
              </Link>
            }
          >
            {online
              ? "Your library is fine. We'll try again when the connection settles."
              : "You're offline. We'll load it as soon as you're back online."}
          </EmptyState>
        ) : (
          <EmptyState
            icon="search"
            title="We couldn't find this show"
            action={
              <Link href="/app/discover" className={buttonClasses("primary")}>
                Search Discover
              </Link>
            }
          >
            The link may be out of date, or TVmaze no longer lists it.
          </EmptyState>
        )}
      </div>
    );
  }

  const status = show.status ? SHOW_STATUS[show.status] : null;
  const ratingValue = (ratingRow?.rating ?? entry?.rating ?? 0) / 2;
  const spoilerMode = settings?.spoilerMode ?? "blur";
  const pct = aired.length ? Math.round((watchedAired / aired.length) * 100) : 0;

  const seasonTabs: TabItem[] = seasons.map(([n, eps]) => {
    const airedHere = eps.filter((e) => isAired(e, now));
    const doneHere = airedHere.filter((e) => watched.has(e.id)).length;
    const lastWatched = eps.reduce((m, e) => (watched.has(e.id) ? Math.max(m, e.number) : m), 0);
    const hasShielded = spoilerMode !== "show" && eps.some((e) => !watched.has(e.id) && e.summary);
    const complete = airedHere.length > 0 && doneHere === airedHere.length;
    return {
      id: String(n),
      label: n === 0 ? "Specials" : <>Season <span className="k-tabular">{n}</span></>,
      count: eps.length,
      content: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-k-sm text-text-2">
              <span className="k-tabular font-medium text-text">{doneHere}</span> of{" "}
              <span className="k-tabular">{airedHere.length}</span> aired watched
              {eps.length > airedHere.length && <span className="text-text-3"> · {eps.length - airedHere.length} upcoming</span>}
            </p>
            {hasShielded && (
              <p className="inline-flex items-center gap-1.5 text-k-sm text-text-3">
                <Icon name="spoiler" size={16} />
                {lastWatched > 0 ? `Spoilers past E${lastWatched} are hidden.` : "Synopses stay hidden until you watch."}{" "}
                <Link href="/app/profile" className="underline decoration-line-strong underline-offset-2 hover:text-text-2">
                  Change
                </Link>
              </p>
            )}
            <Button
              variant={complete ? "ghost" : "secondary"}
              size="sm"
              leadingIcon="check-double"
              disabled={complete || airedHere.length === 0}
              onClick={() => void markSeason(n, eps)}
              className="min-h-11 sm:ml-auto sm:min-h-8"
            >
              {complete ? `${n === 0 ? "Specials" : "Season"} watched` : `Mark ${n === 0 ? "specials" : "season"} watched`}
            </Button>
          </div>
          <ul className="-mx-2 flex flex-col sm:-mx-3" aria-label={n === 0 ? "Specials" : `Season ${n} episodes`}>
            {eps.map((ep) => {
              const isWatched = watched.has(ep.id);
              return (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  watched={isWatched}
                  aired={isAired(ep, now)}
                  shielded={!isWatched}
                  spoilerMode={spoilerMode}
                  onToggle={toggleEpisode}
                  showTitle={show.title}
                />
              );
            })}
          </ul>
        </div>
      ),
    };
  });

  return (
    <div className="flex flex-col gap-8">
      {back}

      {state.status === "error" && (
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
            ? "Couldn't refresh from TVmaze. You're seeing the copy saved on this device."
            : "Offline. You're seeing the copy saved on this device, and changes save locally."}
        </InlineNotice>
      )}

      <MediaHero
        title={show.title}
        year={show.year}
        poster={show.poster}
        backdrop={show.backdrop}
        summary={show.summary}
        eyebrow={
          <>
            <span>Show</span>
            {show.year && <><span aria-hidden>·</span><span className="k-tabular">{show.year}</span></>}
            {show.network && <><span aria-hidden>·</span><span>{show.network}</span></>}
          </>
        }
        meta={
          <>
            {status && <Badge tone={status.tone}>{status.label}</Badge>}
            {show.runtime ? <Badge mono tone="outline">{show.runtime} min</Badge> : null}
            {show.genres?.slice(0, 3).map((g) => (
              <Badge key={g} tone="neutral">
                {g}
              </Badge>
            ))}
          </>
        }
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {entry ? (
              <>
                <label className="relative inline-flex">
                  <span className="sr-only">Status for {show.title}</span>
                  <select
                    value={entry.status}
                    onChange={(e) => void onStatus(e.target.value as TrackStatus)}
                    className={cx(
                      buttonClasses("secondary", "md"),
                      "min-h-11 appearance-none pl-9 pr-9 sm:min-h-10",
                    )}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Icon name="check" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-success" />
                  <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-3" />
                </label>
                <Button variant="ghost" onClick={() => void onRemove(entry)} className="min-h-11 sm:min-h-10">
                  Remove
                </Button>
              </>
            ) : (
              <>
                <Button leadingIcon="plus" onClick={() => void onFollow("watching")} className="min-h-11 sm:min-h-10">
                  Follow
                </Button>
                <Button variant="secondary" leadingIcon="list" onClick={() => void onFollow("watchlist")} className="min-h-11 sm:min-h-10">
                  Watchlist
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-k-sm font-semibold uppercase tracking-[0.06em] text-text-3">Your rating</span>
            <Rating value={ratingValue} onChange={(v) => void onRate(v)} label={`Your rating for ${show.title}`} size={24} />
          </div>
        </div>
      </MediaHero>

      {aired.length > 0 && (
        <section aria-labelledby="progress-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="progress-h" className="text-k-sm font-semibold uppercase tracking-[0.06em] text-text-3">
              Progress
            </h2>
            <p className="text-k-sm text-text-2">
              <span className="k-tabular font-medium text-text">{watchedAired}</span> of <span className="k-tabular">{aired.length}</span> aired
              episodes
              {remainingMinutes > 0 && <span className="text-text-3"> · {formatDuration(remainingMinutes)} left</span>}
            </p>
          </div>
          <ProgressBar
            value={watchedAired}
            max={aired.length}
            label={`${show.title} progress`}
            valueText={`${watchedAired} of ${aired.length} episodes, ${pct}%`}
            tone={watchedAired === aired.length ? "success" : "accent"}
            size="md"
            segments={aired.length <= 60 ? aired.length : undefined}
          />
          {nextUp && (
            <p className="text-k-base text-text-2">
              Up next:{" "}
              <span className="k-slate text-text-3">{slate(nextUp.season, nextUp.number)}</span>{" "}
              {spoilerMode === "hide" ? "" : <span className="text-text">{nextUp.title}</span>}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="episodes-h" className="flex flex-col gap-2">
        <h2 id="episodes-h" className="font-display text-k-xl font-medium tracking-[-0.01em] text-text">
          Episodes
        </h2>
        {seasons.length > 0 ? (
          <Tabs items={seasonTabs} value={selectedSeason} onValueChange={setSeason} label={`${show.title} seasons`} />
        ) : fetching || episodes === undefined ? (
          <LoadingRegion label="Loading episodes">
            <ul className="flex flex-col gap-1">
              {Array.from({ length: 6 }, (_, i) => (
                <EpisodeRowSkeleton key={i} />
              ))}
            </ul>
          </LoadingRegion>
        ) : (
          <EmptyState
            icon="tv"
            title="No episodes listed yet"
            action={
              <Button variant="secondary" onClick={retry} disabled={!online}>
                Check again
              </Button>
            }
          >
            TVmaze hasn&rsquo;t published an episode list for this show. Follow it and we&rsquo;ll pick up new episodes as they&rsquo;re announced.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
