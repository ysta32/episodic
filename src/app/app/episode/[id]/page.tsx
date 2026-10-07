"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { isWatched, markWatched, parseEpisodeId, unmarkWatched } from "@/lib/library";
import { getSettings } from "@/lib/lists";
import { Badge, Button, Icon, Kbd, Skeleton, ToastProvider, useToast } from "@/components/ui";
import { ReactionBar } from "@/components/app/ReactionBar";
import { Thread, useThread } from "@/components/app/Thread";
import { getIdentity, type Identity } from "@/components/app/identity";

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function formatAirdate(d?: string): string | null {
  if (!d) return null;
  const t = new Date(`${d}T12:00:00`);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const pad = (n: number) => String(n).padStart(2, "0");

function EpisodeView({ episodeId }: { episodeId: string }) {
  const { toast } = useToast();
  const parsed = useMemo(() => parseEpisodeId(episodeId), [episodeId]);
  const episode = useLiveQuery(async () => (await db().episodes.get(episodeId)) ?? null, [episodeId]);
  const show = useLiveQuery(async () => (parsed ? ((await db().shows.get(parsed.showId)) ?? null) : null), [parsed]);
  const entry = useLiveQuery(async () => (parsed ? ((await db().library.get(parsed.showId)) ?? null) : null), [parsed]);
  const watched = useLiveQuery(() => isWatched(episodeId), [episodeId]);
  const settings = useLiveQuery(() => getSettings());
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    if (settings) setIdentity(getIdentity(settings.displayName));
  }, [settings]);

  const data = useThread(episodeId, identity);
  const season = episode?.season ?? parsed?.season;
  const number = episode?.number ?? parsed?.number;
  const showTitle = show?.title ?? entry?.title;
  const isWatchedNow = watched === true;

  async function toggleWatched() {
    if (watched === undefined) return;
    const label = season !== undefined && number !== undefined ? `S${season} · E${number}` : "this episode";
    if (isWatchedNow) {
      await unmarkWatched(episodeId);
      toast({ title: `Marked ${label} unwatched`, undo: () => void markWatched([episodeId]) });
    } else {
      try {
        await markWatched([episodeId]);
        toast({ title: `Marked ${label} watched`, tone: "success", undo: () => void unmarkWatched(episodeId) });
      } catch {
        toast({ title: "Couldn't mark that watched", description: "Your library is unchanged. Try again.", tone: "danger" });
      }
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "w") {
        e.preventDefault();
        void toggleWatched();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!parsed) {
    return (
      <main className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 lg:px-8">
        <div role="alert" className="rounded-k-md border border-line-strong bg-surface p-5">
          <h1 className="font-display text-k-xl font-medium text-text">That episode link doesn&apos;t look right</h1>
          <p className="mt-2 text-k-base text-text-2">Open it from your library or Up Next and it&apos;ll find its way here.</p>
        </div>
      </main>
    );
  }

  const air = formatAirdate(episode?.airdate);
  const loadingMeta = episode === undefined || show === undefined;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href={`/app/lists`}
        className="inline-flex min-h-11 items-center gap-1 text-k-sm font-semibold text-text-2 hover:text-text"
      >
        <Icon name="chevron-left" size={16} />
        Back
      </Link>

      <header className="mt-2 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {loadingMeta ? (
            <div className="flex flex-col gap-3">
              <Skeleton delay={120} className="h-3 w-40" />
              <Skeleton delay={120} className="h-9 w-72 max-w-full" />
            </div>
          ) : (
            <>
              <p className="k-slate flex flex-wrap items-center gap-x-2 text-text-2">
                {showTitle && <i className="font-display text-k-sm normal-case tracking-normal">{showTitle}</i>}
                <span className="font-mono">S{pad(season ?? 0)} · E{pad(number ?? 0)}</span>
                {air && <span className="font-mono text-text-3">{air}</span>}
              </p>
              <h1 className="mt-1 font-display text-k-2xl font-medium tracking-[-0.02em] text-text">
                {episode?.title ?? `Episode ${number}`}
              </h1>
              {!episode && (
                <p className="mt-1 text-k-sm text-text-2">Details for this episode haven&apos;t synced yet. The thread still works.</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isWatchedNow && <Badge tone="success">Watched</Badge>}
          <Button
            variant={isWatchedNow ? "secondary" : "primary"}
            leadingIcon={isWatchedNow ? "undo" : "check"}
            disabled={watched === undefined}
            onClick={() => void toggleWatched()}
            aria-pressed={isWatchedNow}
          >
            {isWatchedNow ? "Mark unwatched" : "Mark watched"}
          </Button>
          <Kbd>w</Kbd>
        </div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 lg:order-1">
          <Thread
            data={data}
            identity={identity}
            watched={isWatchedNow}
            spoilerMode={settings?.spoilerMode ?? "blur"}
            onToast={(t) => toast(t)}
          />
        </div>
        <aside className="order-1 min-w-0 lg:order-2">
          <div className="lg:sticky lg:top-6">
            <ReactionBar
              counts={data.counts}
              mine={data.mine}
              shielded={!isWatchedNow && (settings?.spoilerMode ?? "blur") !== "show"}
              disabled={!identity || !data.online || data.status === "loading"}
              onPick={(r) => {
                void data.react(r).then((err) => {
                  if (err) toast({ title: "Reaction not saved", description: err, tone: "danger" });
                });
              }}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ToastProvider>
      <EpisodeView episodeId={safeDecode(id)} />
    </ToastProvider>
  );
}
