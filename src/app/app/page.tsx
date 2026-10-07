"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ActionLink, ErrorBanner, FirstRun } from "@/components/app/EmptyState";
import { slate, UpNextCard } from "@/components/app/UpNextCard";
import { EmptyState, LoadingRegion, Skeleton, useToast } from "@/components/ui";
import { db } from "@/lib/db";
import { markWatched, upNext, type UpNextItem } from "@/lib/library";

function UpNextSkeletons() {
  return (
    <LoadingRegion label="Loading your Up Next" className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-k-md border border-line bg-surface p-2.5">
          <Skeleton delay={120} className="aspect-[2/3] w-16 shrink-0 sm:w-20" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <Skeleton delay={120} className="h-4 w-2/5" />
            <Skeleton delay={120} className="h-3 w-3/5" />
            <Skeleton delay={120} className="h-3 w-1/4" />
          </div>
          <Skeleton delay={120} rounded="pill" className="size-11 self-center" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export default function UpNextPage() {
  const { toast } = useToast();
  const count = useLiveQuery(() => db().library.count());
  const items = useLiveQuery(() => upNext());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [stamped, setStamped] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const timers = useRef<Map<string, number>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((h) => window.clearTimeout(h));
  }, []);

  const cancelTimer = (id: string) => {
    const h = timers.current.get(id);
    if (h !== undefined) window.clearTimeout(h);
    timers.current.delete(id);
  };

  const hide = (id: string, on: boolean) =>
    setGone((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const onWatched = useCallback(
    async (item: UpNextItem) => {
      const id = item.next.id;
      if (inFlight.current.has(id)) return;
      inFlight.current.add(id);
      setFailed(false);
      setStamped(id);
      // Optimistic: let the phosphor stamp play, then drop the card while the write lands.
      const at = Date.now();
      cancelTimer(id);
      timers.current.set(id, window.setTimeout(() => { timers.current.delete(id); hide(id, true); }, 260));
      try {
        await markWatched([id], at);
        toast({
          title: `Marked ${slate(item.next.season, item.next.number)} watched`,
          description: item.show.title,
          tone: "success",
          undo: () => {
            cancelTimer(id);
            db().watches.where("mediaId").equals(id).and((w) => w.watchedAt === at).delete().then(
              () => hide(id, false),
              () => toast({ title: "Couldn't undo that", description: "It's still marked watched. Try again from the episode page.", tone: "danger" }),
            );
          },
        });
      } catch {
        cancelTimer(id);
        hide(id, false);
        setFailed(true);
        toast({ title: "Couldn't save that", description: "Nothing changed. Your library is fine.", tone: "danger" });
      } finally {
        inFlight.current.delete(id);
        setStamped((s) => (s === id ? null : s));
      }
    },
    [toast],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    const cards = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-upnext]") ?? []);
    const idx = cards.findIndex((c) => c.contains(target));
    if (idx < 0) return;
    const focusCard = (i: number) => cards[i]?.querySelector<HTMLElement>("a:not([tabindex='-1']), button")?.focus();
    if (e.key === "j") focusCard(Math.min(idx + 1, cards.length - 1));
    else if (e.key === "k") focusCard(Math.max(idx - 1, 0));
    else if (e.key === "x") {
      const visible = (items ?? []).filter((i) => !gone.has(i.next.id));
      const item = visible[idx];
      if (item) {
        e.preventDefault();
        void onWatched(item);
      }
    }
  };

  if (count === undefined || items === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-6 font-display text-k-2xl font-medium tracking-[-0.02em]">Up next</h1>
        <UpNextSkeletons />
      </div>
    );
  }
  if (count === 0) return <FirstRun />;

  const visible = items.filter((i) => !gone.has(i.next.id));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <h1 className="font-display text-k-2xl font-medium tracking-[-0.02em]">Up next</h1>
        {visible.length > 0 && <p className="k-slate k-tabular text-text-3">{visible.length} {visible.length === 1 ? "show" : "shows"} waiting</p>}
      </header>
      {failed && <div className="mb-4"><ErrorBanner>We couldn&apos;t save that watch. Nothing changed and your library is fine. Try the check again.</ErrorBanner></div>}
      {visible.length === 0 ? (
        <EmptyState
          icon="check-double"
          title="You're all caught up"
          action={<ActionLink href="/app/discover">Find something new</ActionLink>}
          secondary={<ActionLink href="/app/import" variant="secondary">Import more history</ActionLink>}
        >
          Nothing aired is waiting on you. Check the calendar for what&apos;s next, or start something from your list.
        </EmptyState>
      ) : (
        <ul ref={listRef} onKeyDown={onKeyDown} aria-label="Shows with an unwatched episode" className="flex flex-col gap-3">
          {visible.map((item) => (
            <UpNextCard key={item.show.id} item={item} onWatched={onWatched} stamped={stamped === item.next.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
