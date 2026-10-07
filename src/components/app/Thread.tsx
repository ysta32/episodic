"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REACTIONS,
  type Comment,
  type Reaction,
  type ReactionCounts,
} from "@/lib/social/types";
import { Button, EmptyState, IconButton, Icon, LoadingRegion, Skeleton, cx } from "@/components/ui";
import { GifPicker, gifPickerEnabled } from "./GifPicker";
import type { Identity } from "./identity";

export const MAX_BODY = 1000;
type Gif = NonNullable<Comment["gif"]>;
export type SpoilerMode = "blur" | "hide" | "show";
export type ThreadStatus = "loading" | "ready" | "offline" | "error";

const emptyCounts = (): ReactionCounts => ({ love: 0, lol: 0, shocked: 0, sad: 0, angry: 0, bored: 0 });

interface PageResponse {
  comments: Comment[];
  reactions: ReactionCounts;
  nextBefore?: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parsePage(v: unknown): PageResponse | null {
  if (!isRecord(v) || !Array.isArray(v.comments) || !isRecord(v.reactions)) return null;
  const counts = emptyCounts();
  for (const r of REACTIONS) {
    const n = v.reactions[r];
    counts[r] = typeof n === "number" && Number.isFinite(n) ? n : 0;
  }
  const comments = v.comments.filter(
    (c): c is Comment => isRecord(c) && typeof c.id === "string" && typeof c.body === "string" && typeof c.createdAt === "number",
  );
  return { comments, reactions: counts, nextBefore: typeof v.nextBefore === "number" ? v.nextBefore : undefined };
}

function describeError(status: number, code: string | undefined, retryAfter: string | null): string {
  if (status === 429) {
    const s = Number(retryAfter);
    return Number.isFinite(s) && s > 0
      ? `You're posting fast. Try again in ${Math.ceil(s)}s. Your text is still here.`
      : "You're posting fast. Give it a moment. Your text is still here.";
  }
  if (status === 400) {
    if (code === "body_empty") return "Write something first.";
    if (code === "body_too_long") return `Keep it under ${MAX_BODY} characters.`;
    if (code === "body_too_many_links") return "Two links at most. Your text is still here.";
    if (code?.startsWith("body_") || code?.startsWith("author_")) return "That didn't pass the thread filter. Try rewording it.";
    return "That couldn't be posted. Check it and try again.";
  }
  return "Couldn't post just now. Your text is safe here, so try again shortly.";
}

const cacheKey = (id: string) => `episodic.thread.${id}`;
const mineKey = (id: string) => `episodic.reaction.${id}`;
const hiddenKey = "episodic.reported";

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the in-memory state still works for this session */
  }
}

export type PostResult = { ok: true } | { ok: false; error: string };

export interface ThreadData {
  status: ThreadStatus;
  comments: Comment[];
  counts: ReactionCounts | null;
  mine: Reaction | null;
  hasMore: boolean;
  reacting: boolean;
  loadingMore: boolean;
  online: boolean;
  reload: () => void;
  loadOlder: () => void;
  react: (r: Reaction) => Promise<string | null>;
  post: (input: { body: string; spoiler: boolean; gif?: Gif }) => Promise<PostResult>;
  report: (id: string, reason: string) => Promise<boolean>;
  hide: (id: string) => void;
  unhide: (id: string) => void;
  hiddenIds: ReadonlySet<string>;
}

export function useThread(episodeId: string, identity: Identity | null): ThreadData {
  const [status, setStatus] = useState<ThreadStatus>("loading");
  const [comments, setComments] = useState<Comment[]>([]);
  const [counts, setCounts] = useState<ReactionCounts | null>(null);
  const [mine, setMine] = useState<Reaction | null>(null);
  const [nextBefore, setNextBefore] = useState<number | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [online, setOnline] = useState(true);
  const [reacting, setReacting] = useState(false);
  const [tick, setTick] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const url = `/api/threads/${encodeURIComponent(episodeId)}`;

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setTick((t) => t + 1);
    };
    const goOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const saved = readJson(mineKey(episodeId));
    setMine(typeof saved === "string" && (REACTIONS as readonly string[]).includes(saved) ? (saved as Reaction) : null);
    const rep = readJson(hiddenKey);
    setHiddenIds(new Set(Array.isArray(rep) ? rep.filter((x): x is string => typeof x === "string") : []));
  }, [episodeId]);

  useEffect(() => {
    const ctl = new AbortController();
    setStatus("loading");
    (async () => {
      try {
        const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
        const page = res.ok ? parsePage(await res.json()) : null;
        if (!page) throw new Error("bad_response");
        setComments(page.comments);
        setCounts(page.reactions);
        setNextBefore(page.nextBefore);
        setStatus("ready");
        writeJson(cacheKey(episodeId), page);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const cached = parsePage(readJson(cacheKey(episodeId)));
        if (cached) {
          setComments(cached.comments);
          setCounts(cached.reactions);
          setNextBefore(undefined);
          setStatus("offline");
        } else {
          setStatus(navigator.onLine ? "error" : "offline");
        }
      }
    })();
    return () => ctl.abort();
  }, [url, episodeId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const loadOlder = useCallback(async () => {
    if (nextBefore === undefined || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${url}?before=${nextBefore}`, { cache: "no-store" });
      const page = res.ok ? parsePage(await res.json()) : null;
      if (!page) throw new Error("bad_response");
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...page.comments.filter((c) => !seen.has(c.id)), ...prev];
      });
      setNextBefore(page.nextBefore);
    } catch {
      setStatus("offline");
    } finally {
      setLoadingMore(false);
    }
  }, [url, nextBefore, loadingMore]);

  const react = useCallback(
    async (r: Reaction): Promise<string | null> => {
      if (!identity || mine === r || reacting) return null;
      setReacting(true);
      const prevMine = mine;
      const prevCounts = counts;
      setMine(r);
      setCounts((c) => {
        const next = { ...(c ?? emptyCounts()) };
        if (prevMine) next[prevMine] = Math.max(0, next[prevMine] - 1);
        next[r] += 1;
        return next;
      });
      const rollback = (msg: string) => {
        setReacting(false);
        setMine(prevMine);
        setCounts(prevCounts);
        return msg;
      };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction: r, authorId: identity.authorId }),
        });
        const parsed: unknown = await res.json().catch(() => null);
        const server = res.ok ? parsePage({ comments: [], reactions: parsed }) : null;
        if (!server) return rollback("Couldn't save your reaction. It's not lost; try again.");
        setCounts(server.reactions);
        writeJson(mineKey(episodeId), r);
        setReacting(false);
        return null;
      } catch {
        return rollback("Reactions need a connection. Try again when you're back online.");
      }
    },
    [identity, mine, counts, reacting, url, episodeId],
  );

  const post = useCallback(
    async (input: { body: string; spoiler: boolean; gif?: Gif }): Promise<PostResult> => {
      if (!identity) return { ok: false, error: "Still getting ready. Try again in a second." };
      const tempId = `pending-${crypto.randomUUID()}`;
      const temp: Comment = {
        id: tempId,
        episodeId,
        author: identity.author,
        authorId: identity.authorId,
        body: input.body,
        spoiler: input.spoiler,
        gif: input.gif,
        createdAt: Date.now(),
      };
      setComments((prev) => [...prev, temp]);
      const drop = () => setComments((prev) => prev.filter((c) => c.id !== tempId));
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, author: identity.author, authorId: identity.authorId }),
        });
        const data: unknown = await res.json().catch(() => null);
        if (res.status === 201 && isRecord(data) && typeof data.id === "string" && typeof data.createdAt === "number") {
          const saved = data as unknown as Comment;
          setComments((prev) => prev.map((c) => (c.id === tempId ? saved : c)));
          return { ok: true };
        }
        drop();
        const code = isRecord(data) && typeof data.error === "string" ? data.error : undefined;
        return { ok: false, error: describeError(res.status, code, res.headers.get("Retry-After")) };
      } catch {
        drop();
        return { ok: false, error: "Posting needs a connection. Your text is still here." };
      }
    },
    [identity, episodeId, url],
  );

  const persistHidden = (next: Set<string>) => writeJson(hiddenKey, [...next].slice(-500));
  const hide = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev).add(id);
      persistHidden(next);
      return next;
    });
  }, []);
  const unhide = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistHidden(next);
      return next;
    });
  }, []);

  const report = useCallback(
    async (id: string, reason: string): Promise<boolean> => {
      if (!identity) return false;
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId: id, episodeId, reason, reporterId: identity.authorId }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [identity, episodeId],
  );

  return {
    status, comments, counts, mine, reacting, hasMore: nextBefore !== undefined, loadingMore, online,
    reload, loadOlder, react, post, report, hide, unhide, hiddenIds,
  };
}

const REASONS = ["Spam", "Harassment or hate", "Spoiler not marked", "Something else"] as const;

function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CommentItem({
  c, mine, mode, onReport, now,
}: {
  c: Comment;
  mine: boolean;
  mode: SpoilerMode;
  onReport: (id: string, reason: string) => void;
  now: number;
}) {
  const [revealed, setRevealed] = useState(mode === "show");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const pending = c.id.startsWith("pending-");
  const shielded = c.spoiler && !revealed && !mine;
  const hidden = shielded && mode === "hide";

  return (
    <li className={cx("k-enter-up rounded-k-md border border-line bg-surface p-4", pending && "opacity-70")}>
      <div className="flex items-center gap-2 text-k-sm">
        <span className="font-semibold text-text">{c.author}</span>
        {mine && <span className="k-slate text-accent-ink">You</span>}
        {c.spoiler && <span className="k-slate text-text-2">Spoiler</span>}
        <span className="k-tabular ml-auto text-k-xs text-text-3">{pending ? "Posting…" : timeAgo(c.createdAt, now)}</span>
      </div>
      {hidden ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-2 min-h-11 w-full rounded-k-sm bg-surface-2 px-3 text-left text-k-sm text-text-2 hover:text-text"
        >
          Spoiler comment hidden. Show it
        </button>
      ) : (
        <div className="relative mt-2">
          <div
            aria-hidden={shielded}
            className={cx("transition-[filter] duration-(--k-dur-2)", shielded && "pointer-events-none select-none blur-md")}
          >
            <p className="max-w-[68ch] whitespace-pre-wrap break-words text-k-base text-text">{c.body}</p>
            {c.gif && (
              // eslint-disable-next-line @next/next/no-img-element -- remote animated GIF, no optimizer
              <img src={c.gif.url} width={c.gif.width} height={c.gif.height} alt="GIF attached to the comment" loading="lazy" className="mt-2 h-auto max-h-60 w-auto max-w-full rounded-k-sm" />
            )}
          </div>
          {shielded && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="absolute inset-0 flex items-center justify-center gap-2 rounded-k-sm text-k-sm font-semibold text-text"
            >
              <Icon name="spoiler" size={16} />
              Tap to show spoiler
            </button>
          )}
        </div>
      )}
      {!mine && !pending && (
        <div className="mt-2 -mb-1">
          {reporting ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`reason-${c.id}`}>Reason for reporting</label>
              <select
                id={`reason-${c.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-11 rounded-k-sm border border-line-strong bg-bg px-2 text-k-sm text-text"
              >
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <Button size="sm" variant="danger" className="min-h-11" onClick={() => onReport(c.id, reason)}>Report</Button>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setReporting(false)}>Cancel</Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="min-h-11 rounded-k-sm px-1 text-k-xs font-semibold text-text-2 hover:text-danger"
              aria-label={`Report comment by ${c.author}`}
            >
              Report
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export interface ThreadProps {
  data: ThreadData;
  identity: Identity | null;
  watched: boolean;
  spoilerMode: SpoilerMode;
  onToast: (t: { title: string; description?: string; tone?: "success" | "danger" | "info"; undo?: () => void }) => void;
}

export function Thread({ data, identity, watched, spoilerMode, onToast }: ThreadProps) {
  const [overridden, setOverridden] = useState(false);
  const gated = !watched && !overridden && spoilerMode !== "show";
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [gif, setGif] = useState<Gif | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const taRef = useRef<HTMLTextAreaElement>(null);
  const readOnly = !data.online || data.status === "offline";

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const sorted = [...data.comments]
    .filter((c) => !data.hiddenIds.has(c.id))
    .sort((a, b) => b.createdAt - a.createdAt);
  const remaining = MAX_BODY - body.length;
  const canSend = body.trim().length > 0 && remaining >= 0 && !busy && !readOnly && identity !== null;

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    const text = body.trim();
    const res = await data.post({ body: text, spoiler, gif: gif ?? undefined });
    setBusy(false);
    if (res.ok) {
      setBody((cur) => (cur.trim() === text ? "" : cur));
      setGif(null);
      setSpoiler(false);
      setGifOpen(false);
    } else {
      setError(res.error);
    }
  }

  async function report(id: string, reason: string) {
    data.hide(id);
    const ok = await data.report(id, reason);
    if (ok) {
      onToast({ title: "Reported. Hidden for you.", description: "Thanks. We'll take a look.", tone: "success", undo: () => data.unhide(id) });
    } else {
      onToast({
        title: "Hidden for you, report not sent",
        description: "Couldn't reach the server. You can report it again later.",
        tone: "info",
        undo: () => data.unhide(id),
      });
    }
  }

  return (
    <section aria-labelledby="thread-h" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="thread-h" className="font-display text-k-xl font-medium tracking-[-0.01em] text-text">Thread</h2>
        {data.status === "ready" && <span className="k-tabular text-k-xs text-text-3">{sorted.length} {sorted.length === 1 ? "comment" : "comments"}</span>}
      </div>

      {readOnly && (
        <p role="status" className="flex items-center gap-2 rounded-k-sm border border-line bg-surface-2 px-3 py-2 text-k-sm text-text-2">
          <Icon name="offline" size={16} />
          Reactions need a connection. Cached posts are read-only.
          <button type="button" onClick={data.reload} className="ml-auto min-h-11 rounded-k-sm px-2 font-semibold text-text hover:underline">Retry</button>
        </p>
      )}

      {/* composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        className="flex flex-col gap-3 rounded-k-md border border-line bg-surface p-3 sm:p-4"
      >
        <label htmlFor="composer" className="sr-only">Add a comment</label>
        <textarea
          id="composer"
          ref={taRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
          rows={3}
          placeholder="What did you think? Mark spoilers so others stay safe."
          aria-describedby="composer-meta"
          aria-invalid={remaining < 0 || error !== null}
          disabled={readOnly}
          className="w-full resize-y rounded-k-sm border border-line-strong bg-bg p-3 text-k-base text-text placeholder:text-text-3 disabled:opacity-60"
        />
        {gif && (
          <div className="flex items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote animated GIF, no optimizer */}
            <img src={gif.url} width={gif.width} height={gif.height} alt="Selected GIF" className="h-20 w-auto rounded-k-sm" />
            <IconButton icon="close" label="Remove GIF" size="sm" onClick={() => setGif(null)} />
          </div>
        )}
        {gifOpen && gifPickerEnabled() && (
          <GifPicker onPick={(g) => { setGif(g); setGifOpen(false); taRef.current?.focus(); }} onClose={() => setGifOpen(false)} />
        )}
        <div id="composer-meta" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-k-sm text-text">
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="size-5 accent-[var(--k-accent)]" />
            Contains spoilers
          </label>
          {gifPickerEnabled() && (
            <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setGifOpen((o) => !o)} aria-expanded={gifOpen}>GIF</Button>
          )}
          <span
            className={cx("k-tabular ml-auto font-mono text-k-xs", remaining < 0 ? "text-danger" : remaining < 100 ? "text-accent-ink" : "text-text-3")}
            aria-live="polite"
          >
            {remaining}
          </span>
          <Button type="submit" size="md" className="min-h-11" disabled={!canSend} loading={busy}>Post</Button>
        </div>
        {error && (
          <p role="alert" className="rounded-k-sm border border-danger bg-danger-wash px-3 py-2 text-k-sm text-text">{error}</p>
        )}
        <p className="text-k-xs text-text-3">Posting as {identity?.author ?? "…"}. Press Ctrl or Cmd + Enter to post.</p>
      </form>

      {/* list */}
      <div className={cx("relative", gated && "min-h-56")}>
        <div aria-hidden={gated} className={cx(gated && "pointer-events-none select-none blur-md")} inert={gated}>
          {data.status === "loading" && (
            <LoadingRegion label="Loading comments" className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} delay={120} className="h-24 w-full" rounded="md" />)}
            </LoadingRegion>
          )}
          {data.status === "error" && (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-k-md border border-danger bg-surface p-4">
              <p className="text-k-base text-text">Couldn&apos;t load the thread. Your library is fine; this is only the comments.</p>
              <Button variant="secondary" size="sm" onClick={data.reload}>Retry</Button>
            </div>
          )}
          {(data.status === "ready" || data.status === "offline") && sorted.length === 0 && (
            <EmptyState icon="slate" title="No one's weighed in yet">
              Be the first. Say what landed, and tick the spoiler box if it gives anything away.
            </EmptyState>
          )}
          {sorted.length > 0 && (
            <ul className="flex flex-col gap-3">
              {sorted.map((c) => (
                <CommentItem
                  key={c.id}
                  c={c}
                  mine={identity?.authorId === c.authorId}
                  mode={spoilerMode}
                  now={now}
                  onReport={(id, r) => void report(id, r)}
                />
              ))}
            </ul>
          )}
          {data.hasMore && (
            <div className="mt-4">
              <Button variant="secondary" loading={data.loadingMore} onClick={data.loadOlder}>Load older</Button>
            </div>
          )}
        </div>
        {gated && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            <div className="flex max-w-sm flex-col items-start gap-3 rounded-k-md border border-line bg-surface p-5 shadow-k-2">
              <p className="font-display text-k-lg font-medium text-text">You haven&apos;t watched this yet.</p>
              <p className="text-k-sm text-text-2">Comments can give things away. Reveal them anyway?</p>
              <Button leadingIcon="eye" onClick={() => setOverridden(true)}>Reveal comments</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
