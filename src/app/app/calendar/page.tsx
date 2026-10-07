"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionLink, ErrorBanner } from "@/components/app/EmptyState";
import { ShowPoster } from "@/components/app/ShowPoster";
import { EmptyState, LoadingRegion, Skeleton } from "@/components/ui";
import { db } from "@/lib/db";
import { clientProvider } from "@/lib/meta";
import type { Episode } from "@/lib/types";

const PAST = 7;
const AHEAD = 14;
const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (d: Date, days: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
};

/** Local calendar day an episode airs on. */
function airDay(ep: Episode): string | null {
  if (ep.airstamp) {
    const t = Date.parse(ep.airstamp);
    if (Number.isFinite(t)) return key(new Date(t));
  }
  return ep.airdate ?? null;
}

function label(day: string, today: Date): { main: string; sub: string } {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sub = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  if (day === key(today)) return { main: "Today", sub };
  if (day === key(shift(today, 1))) return { main: "Tomorrow", sub };
  if (day === key(shift(today, -1))) return { main: "Yesterday", sub };
  return { main: date.toLocaleDateString(undefined, { weekday: "long" }), sub: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
}

export default function CalendarPage() {
  const followed = useLiveQuery(() => db().library.where("status").anyOf("watching", "watchlist").filter((e) => e.kind === "show").toArray());
  const shows = useLiveQuery(async () => {
    const ids = (await db().library.where("status").anyOf("watching", "watchlist").toArray()).filter((e) => e.kind === "show").map((e) => e.id);
    return db().shows.bulkGet(ids);
  });
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const idsKey = (followed ?? []).map((e) => e.id).sort().join(",");

  useEffect(() => {
    if (followed === undefined) return;
    const ids = idsKey ? idsKey.split(",") : [];
    if (!ids.length) {
      setEpisodes([]);
      return;
    }
    let live = true;
    const now = new Date();
    const from = key(shift(now, -PAST));
    const to = key(shift(now, AHEAD));
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    Promise.all(chunks.map((c) => clientProvider().schedule(c, from, to)))
      .then((parts) => parts.flat())
      .then((eps) => {
        if (!live) return;
        setError(false);
        setEpisodes(eps);
      })
      .catch(async () => {
        // Offline or TVmaze down: fall back to episodes already saved on this device.
        const wanted = new Set(ids);
        let saved: Episode[] = [];
        try {
          saved = await db().episodes.where("airdate").between(from, to, true, true).filter((e) => wanted.has(e.showId)).toArray();
        } catch {
          saved = [];
        }
        if (!live) return;
        setError(true);
        setEpisodes(saved);
      });
    return () => {
      live = false;
    };
  }, [idsKey, followed, attempt]);

  const retry = useCallback(() => {
    setEpisodes(null);
    setAttempt((a) => a + 1);
  }, []);

  const today = useMemo(() => new Date(), []);
  const groups = useMemo(() => {
    const ids = new Set(idsKey ? idsKey.split(",") : []);
    const from = key(shift(today, -PAST));
    const to = key(shift(today, AHEAD));
    const map = new Map<string, Episode[]>();
    for (const ep of episodes ?? []) {
      const day = airDay(ep);
      if (!day || day < from || day > to || !ids.has(ep.showId)) continue;
      map.set(day, [...(map.get(day) ?? []), ep]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [episodes, idsKey, today]);

  const info = new Map<string, { title: string; poster?: string }>();
  (followed ?? []).forEach((e) => info.set(e.id, { title: e.title }));
  (shows ?? []).forEach((s) => {
    if (s) info.set(s.id, { title: s.title, poster: s.poster });
  });

  const loading = followed === undefined || episodes === null;
  const todayKey = key(today);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="font-display text-k-2xl font-medium tracking-[-0.02em]">Calendar</h1>
        <p className="text-k-base text-text-2">The last {PAST} days and the next {AHEAD}, for shows you follow.</p>
      </header>
      {error && (
        <div className="mb-4">
          <ErrorBanner onRetry={retry}>
            {typeof navigator !== "undefined" && !navigator.onLine
              ? "You're offline, so the schedule can't refresh. Your library is fine, and what we've already saved is shown below."
              : "Couldn't reach TVmaze. Your library is fine, and we'll show what we've saved. Try again in a moment."}
          </ErrorBanner>
        </div>
      )}
      {loading ? (
        <LoadingRegion label="Loading the calendar" className="flex flex-col gap-8">
          {[3, 2].map((rows, g) => (
            <div key={g} className="flex flex-col gap-2">
              <Skeleton delay={120} className="mb-1 h-5 w-32" />
              {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} delay={120} rounded="md" className="h-14 w-full" />
              ))}
            </div>
          ))}
        </LoadingRegion>
      ) : (followed ?? []).length === 0 ? (
        <EmptyState icon="calendar" title="Nothing to chart yet" action={<ActionLink href="/app/discover">Find a show to follow</ActionLink>}>
          Follow a show and its airings land here, grouped by day.
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState icon="calendar" title="Nothing airing this week" action={<ActionLink href="/app/discover">Browse Discover</ActionLink>}>
          Good time to start something from your list.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(([day, eps]) => {
            const l = label(day, today);
            const isToday = day === todayKey;
            const past = day < todayKey;
            return (
              <section key={day} aria-label={`${l.main}, ${l.sub}`} className="k-enter-up flex flex-col gap-2">
                <h2 className="flex items-baseline gap-3 border-b border-line pb-2">
                  <span className={isToday ? "font-display text-k-xl font-medium text-accent-ink" : "font-display text-k-lg font-medium text-text"}>{l.main}</span>
                  <span className="k-slate text-text-3">{l.sub}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {eps
                    .slice()
                    .sort((a, b) => (a.airstamp ?? "").localeCompare(b.airstamp ?? ""))
                    .map((ep) => {
                      const show = info.get(ep.showId);
                      const time = ep.airstamp ? new Date(ep.airstamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
                      return (
                        <li key={ep.id}>
                          <Link
                            href={`/app/episode/${encodeURIComponent(ep.id)}`}
                            className={`flex min-h-14 items-center gap-3 rounded-k-md border border-line bg-surface p-2 pr-3 transition-[border-color,background-color] duration-(--k-dur-1) hover:border-line-strong hover:bg-surface-2 ${past ? "opacity-80" : ""}`}
                          >
                            <ShowPoster src={show?.poster} title={show?.title ?? "Show"} className="w-9 shrink-0" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-display text-k-base font-medium italic">{show?.title ?? "Unknown show"}</span>
                              <span className="flex min-w-0 items-baseline gap-2 text-k-sm text-text-2">
                                <span className="k-slate shrink-0 text-accent-ink">S{ep.season} E{ep.number}</span>
                                <span className="truncate">{ep.title ?? `Episode ${ep.number}`}</span>
                              </span>
                            </span>
                            {time && <span className="k-slate k-tabular shrink-0 text-text-3">{time}</span>}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
