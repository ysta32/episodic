import { REACTIONS, type Comment, type NewComment, type Reaction, type ReactionCounts, type ThreadStore } from "./types";
import { HIDE_AT_REPORTS } from "./moderation";

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_COMMENTS_PER_EPISODE = 500;

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super("rate_limited");
    this.name = "RateLimitError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what}_not_found`);
    this.name = "NotFoundError";
  }
}

export function emptyCounts(): ReactionCounts {
  const c = {} as ReactionCounts;
  for (const r of REACTIONS) c[r] = 0;
  return c;
}

function isReaction(v: unknown): v is Reaction {
  return typeof v === "string" && (REACTIONS as readonly string[]).includes(v);
}

function newId(): string {
  return crypto.randomUUID();
}

function buildComment(episodeId: string, c: NewComment, now: number): Comment {
  const out: Comment = {
    id: newId(), episodeId, author: c.author, authorId: c.authorId, body: c.body,
    spoiler: c.spoiler, createdAt: now, reports: 0,
  };
  if (c.gif) out.gif = { url: c.gif.url, width: c.gif.width, height: c.gif.height, provider: c.gif.provider };
  return out;
}

export interface MemoryStoreOptions { now?: () => number }

/** In-memory ThreadStore. Not shared across server instances; used for dev and tests. */
export function createMemoryStore(opts: MemoryStoreOptions = {}): ThreadStore {
  const now = opts.now ?? Date.now;
  const threads = new Map<string, Comment[]>();
  const byId = new Map<string, Comment>();
  const reporters = new Map<string, Set<string>>();
  const votes = new Map<string, Map<string, Reaction>>();
  const rate = new Map<string, number[]>();

  function tally(episodeId: string): ReactionCounts {
    const counts = emptyCounts();
    const v = votes.get(episodeId);
    if (v) for (const r of v.values()) counts[r] += 1;
    return counts;
  }

  function checkRate(authorId: string): void {
    const t = now();
    const recent = (rate.get(authorId) ?? []).filter((x) => t - x < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      rate.set(authorId, recent);
      const retry = Math.max(1, Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - t) / 1000));
      throw new RateLimitError(retry);
    }
    recent.push(t);
    rate.set(authorId, recent);
    if (rate.size > 10_000) {
      for (const [k, ts] of rate) if (ts.every((x) => t - x >= RATE_LIMIT_WINDOW_MS)) rate.delete(k);
    }
  }

  return {
    async list(episodeId) {
      return (threads.get(episodeId) ?? []).map((c) => structuredClone(c));
    },
    async add(episodeId, c) {
      checkRate(c.authorId);
      const comment = buildComment(episodeId, c, now());
      const list = threads.get(episodeId) ?? [];
      list.push(comment);
      while (list.length > MAX_COMMENTS_PER_EPISODE) {
        const dropped = list.shift();
        if (dropped) { byId.delete(dropped.id); reporters.delete(dropped.id); }
      }
      threads.set(episodeId, list);
      byId.set(comment.id, comment);
      return structuredClone(comment);
    },
    async react(episodeId, r, authorId) {
      if (!isReaction(r)) throw new Error("invalid_reaction");
      let v = votes.get(episodeId);
      if (!v) { v = new Map(); votes.set(episodeId, v); }
      v.set(authorId, r);
      return tally(episodeId);
    },
    async reactions(episodeId) {
      return tally(episodeId);
    },
    async report(commentId, _reason, reporterId) {
      const c = byId.get(commentId);
      if (!c) throw new NotFoundError("comment");
      let set = reporters.get(commentId);
      if (!set) { set = new Set(); reporters.set(commentId, set); }
      set.add(reporterId);
      c.reports = set.size;
      if (set.size >= HIDE_AT_REPORTS) c.hidden = true;
      return { hidden: c.hidden === true };
    },
  };
}

// ---------------- Upstash Redis REST ----------------

type RedisArg = string | number;
type RedisReply = { result?: unknown; error?: string };

export interface RedisConfig { url: string; token: string; fetchImpl?: typeof fetch; now?: () => number }

function redisClient(cfg: RedisConfig) {
  const base = cfg.url.replace(/\/+$/, "");
  const f = cfg.fetchImpl ?? fetch;
  async function pipeline(cmds: RedisArg[][]): Promise<unknown[]> {
    const res = await f(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`redis_http_${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error("redis_bad_response");
    return (data as RedisReply[]).map((d) => {
      if (d && typeof d === "object" && typeof d.error === "string") throw new Error(`redis_error: ${d.error}`);
      return d?.result;
    });
  }
  return { pipeline };
}

const K = {
  thread: (ep: string) => `ep:thread:${ep}`,
  comment: (id: string) => `ep:comment:${id}`,
  reporters: (id: string) => `ep:reporters:${id}`,
  hidden: (ep: string) => `ep:hidden:${ep}`,
  votes: (ep: string) => `ep:votes:${ep}`,
  rate: (authorId: string, bucket: number) => `ep:rl:${authorId}:${bucket}`,
};

function parseComment(raw: unknown): Comment | null {
  if (typeof raw !== "string") return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === "object" && typeof (v as Comment).id === "string") return v as Comment;
  } catch {
    return null;
  }
  return null;
}

export function createRedisStore(cfg: RedisConfig): ThreadStore {
  const r = redisClient(cfg);
  const now = cfg.now ?? Date.now;

  async function tally(episodeId: string): Promise<ReactionCounts> {
    const [vals] = await r.pipeline([["HVALS", K.votes(episodeId)]]);
    const counts = emptyCounts();
    if (Array.isArray(vals)) for (const v of vals) if (isReaction(v)) counts[v] += 1;
    return counts;
  }

  return {
    async list(episodeId) {
      const [ids, hidden] = await r.pipeline([
        ["LRANGE", K.thread(episodeId), -MAX_COMMENTS_PER_EPISODE, -1],
        ["SMEMBERS", K.hidden(episodeId)],
      ]);
      if (!Array.isArray(ids) || ids.length === 0) return [];
      const hiddenSet = new Set(Array.isArray(hidden) ? hidden.map(String) : []);
      const idList = ids.map(String);
      const counts = await r.pipeline([["MGET", ...idList.map(K.comment)], ...idList.map((id) => ["SCARD", K.reporters(id)])]);
      const raws = counts[0];
      const out: Comment[] = [];
      if (!Array.isArray(raws)) return out;
      raws.forEach((raw, i) => {
        const c = parseComment(raw);
        if (!c) return;
        const n = Number(counts[i + 1] ?? 0);
        c.reports = Number.isFinite(n) ? n : 0;
        if (hiddenSet.has(c.id)) c.hidden = true;
        out.push(c);
      });
      return out;
    },
    async add(episodeId, c) {
      const t = now();
      const bucket = Math.floor(t / RATE_LIMIT_WINDOW_MS);
      const rk = K.rate(c.authorId, bucket);
      const [count] = await r.pipeline([["INCR", rk], ["EXPIRE", rk, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 5]]);
      if (Number(count) > RATE_LIMIT_MAX) {
        throw new RateLimitError(Math.max(1, Math.ceil(((bucket + 1) * RATE_LIMIT_WINDOW_MS - t) / 1000)));
      }
      const comment = buildComment(episodeId, c, t);
      await r.pipeline([
        ["SET", K.comment(comment.id), JSON.stringify(comment)],
        ["RPUSH", K.thread(episodeId), comment.id],
        ["LTRIM", K.thread(episodeId), -MAX_COMMENTS_PER_EPISODE, -1],
      ]);
      return comment;
    },
    async react(episodeId, reaction, authorId) {
      if (!isReaction(reaction)) throw new Error("invalid_reaction");
      // Counts are derived from the per-author hash, so switching a vote is a single atomic HSET.
      const [, vals] = await r.pipeline([["HSET", K.votes(episodeId), authorId, reaction], ["HVALS", K.votes(episodeId)]]);
      const counts = emptyCounts();
      if (Array.isArray(vals)) for (const v of vals) if (isReaction(v)) counts[v] += 1;
      return counts;
    },
    async reactions(episodeId) {
      return tally(episodeId);
    },
    async report(commentId, _reason, reporterId) {
      const [raw] = await r.pipeline([["GET", K.comment(commentId)]]);
      const c = parseComment(raw);
      if (!c) throw new NotFoundError("comment");
      const [, n] = await r.pipeline([["SADD", K.reporters(commentId), reporterId], ["SCARD", K.reporters(commentId)]]);
      const hidden = Number(n) >= HIDE_AT_REPORTS;
      if (hidden) await r.pipeline([["SADD", K.hidden(c.episodeId), commentId]]);
      return { hidden };
    },
  };
}

function readRedisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let singleton: ThreadStore | null = null;

export function getThreadStore(): ThreadStore {
  if (singleton) return singleton;
  const env = readRedisEnv();
  singleton = env ? createRedisStore(env) : createMemoryStore();
  return singleton;
}
