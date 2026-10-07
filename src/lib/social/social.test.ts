import { describe, expect, it } from "vitest";
import { HIDE_AT_REPORTS, moderate } from "./moderation";
import { createMemoryStore, createRedisStore, RateLimitError, NotFoundError, RATE_LIMIT_MAX } from "./store";
import type { Comment, NewComment, ReactionCounts } from "./types";
import { GET, POST } from "@/app/api/threads/[episodeId]/route";
import { POST as REPORT } from "@/app/api/report/route";

const nc = (over: Partial<NewComment> = {}): NewComment => ({
  body: "great episode", author: "Ann", authorId: "author-0001", spoiler: false, ...over,
});

let uid = 0;
const freshId = () => `test-user-${Date.now()}-${++uid}`;

describe("moderate", () => {
  it("accepts and cleans normal text", () => {
    const r = moderate("  hello \u0007 world\t\t!\n\n\n\nbye  ");
    expect(r.ok).toBe(true);
    expect(r.clean).toBe("hello world !\n\nbye");
  });
  it("strips zero-width and bidi chars", () => {
    expect(moderate("a\u200Bb\u202Ec").clean).toBe("abc");
  });
  it("rejects empty and whitespace/control-only", () => {
    expect(moderate("").ok).toBe(false);
    expect(moderate("   \u0000\u0001 ").reason).toBe("empty");
  });
  it("enforces length 1..1000", () => {
    expect(moderate("x".repeat(20).padEnd(1000, "ab")).ok).toBe(true);
    expect(moderate("ab".repeat(501)).reason).toBe("too_long");
  });
  it("blocks more than 2 links", () => {
    expect(moderate("see https://a.com and http://b.com").ok).toBe(true);
    expect(moderate("https://a.com https://b.com www.c.com").reason).toBe("too_many_links");
  });
  it("blocks slurs including leetspeak, without Scunthorpe false positives", () => {
    expect(moderate("you are a f4gg0t").reason).toBe("blocked");
    expect(moderate("RETARDS everywhere").reason).toBe("blocked");
    expect(moderate("the raccoon in this episode was spicy").ok).toBe(true);
  });
  it("blocks spam phrases and long repeated chars", () => {
    expect(moderate("Free CRYPTO here").reason).toBe("spam");
    expect(moderate("a" + "!".repeat(40)).reason).toBe("spam");
  });
  it("exports HIDE_AT_REPORTS=3", () => expect(HIDE_AT_REPORTS).toBe(3));
});

describe("memory store", () => {
  it("adds and lists comments per episode", async () => {
    const s = createMemoryStore();
    const c = await s.add("tvmaze:1", nc({ gif: { url: "https://media.giphy.com/x.gif", width: 1, height: 2, provider: "giphy" } }));
    expect(c.id).toBeTruthy();
    expect(c.episodeId).toBe("tvmaze:1");
    expect(c.createdAt).toBeTypeOf("number");
    const list = await s.list("tvmaze:1");
    expect(list.map((x) => x.id)).toEqual([c.id]);
    expect(list[0].gif?.provider).toBe("giphy");
    expect(await s.list("tvmaze:2")).toEqual([]);
    list[0].body = "mutated";
    expect((await s.list("tvmaze:1"))[0].body).toBe("great episode");
  });

  it("rate limits 5 comments/min per author, then recovers", async () => {
    let t = 1_000_000;
    const s = createMemoryStore({ now: () => t });
    for (let i = 0; i < RATE_LIMIT_MAX; i++) await s.add("ep:1", nc());
    await expect(s.add("ep:1", nc())).rejects.toBeInstanceOf(RateLimitError);
    await expect(s.add("ep:1", nc({ authorId: "other-author" }))).resolves.toBeTruthy();
    t += 60_001;
    await expect(s.add("ep:1", nc())).resolves.toBeTruthy();
  });

  it("counts one report per reporter and hides at 3", async () => {
    const s = createMemoryStore();
    const c = await s.add("ep:1", nc());
    expect(await s.report(c.id, "spam", "r1")).toEqual({ hidden: false });
    expect(await s.report(c.id, "spam", "r1")).toEqual({ hidden: false });
    expect(await s.report(c.id, "spam", "r2")).toEqual({ hidden: false });
    expect((await s.list("ep:1"))[0].reports).toBe(2);
    expect(await s.report(c.id, "spam", "r3")).toEqual({ hidden: true });
    const [after] = await s.list("ep:1");
    expect(after.hidden).toBe(true);
    expect(after.reports).toBe(3);
    await expect(s.report("nope", "x", "r1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps one reaction per author per episode; switching moves the vote", async () => {
    const s = createMemoryStore();
    let counts = await s.react("ep:1", "love", "a1");
    counts = await s.react("ep:1", "love", "a2");
    expect(counts.love).toBe(2);
    counts = await s.react("ep:1", "lol", "a1");
    expect(counts.love).toBe(1);
    expect(counts.lol).toBe(1);
    counts = await s.react("ep:1", "lol", "a1");
    expect(counts.lol).toBe(1);
    expect((await s.reactions("ep:2")).love).toBe(0);
    expect(Object.keys(await s.reactions("ep:1")).sort()).toEqual(["angry", "bored", "lol", "love", "sad", "shocked"]);
  });
});

describe("redis store (fake fetch)", () => {
  function fakeUpstash() {
    const kv = new Map<string, string>();
    const lists = new Map<string, string[]>();
    const sets = new Map<string, Set<string>>();
    const hashes = new Map<string, Map<string, string>>();
    const exec = (cmd: string[]): unknown => {
      const [op, k, ...a] = cmd;
      switch (op) {
        case "GET": return kv.get(k) ?? null;
        case "SET": kv.set(k, a[0]); return "OK";
        case "MGET": return [k, ...a].map((x) => kv.get(x) ?? null);
        case "INCR": { const n = Number(kv.get(k) ?? 0) + 1; kv.set(k, String(n)); return n; }
        case "EXPIRE": return 1;
        case "RPUSH": { const l = lists.get(k) ?? []; l.push(...a); lists.set(k, l); return l.length; }
        case "LTRIM": { const l = lists.get(k) ?? []; lists.set(k, l.slice(Number(a[0]))); return "OK"; }
        case "LRANGE": return (lists.get(k) ?? []).slice(Number(a[0]));
        case "SADD": { const st = sets.get(k) ?? new Set(); const had = st.has(a[0]); st.add(a[0]); sets.set(k, st); return had ? 0 : 1; }
        case "SCARD": return sets.get(k)?.size ?? 0;
        case "SMEMBERS": return [...(sets.get(k) ?? [])];
        case "HSET": { const h = hashes.get(k) ?? new Map(); h.set(a[0], a[1]); hashes.set(k, h); return 1; }
        case "HVALS": return [...(hashes.get(k)?.values() ?? [])];
        default: return { __err: `unknown ${op}` };
      }
    };
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const cmds = JSON.parse(String(init?.body)) as string[][];
      return Response.json(cmds.map((c) => ({ result: exec(c) })));
    }) as typeof fetch;
    return fetchImpl;
  }

  it("supports add/list/report/react semantics", async () => {
    let t = 5_000_000;
    const s = createRedisStore({ url: "https://x.upstash.io/", token: "t", fetchImpl: fakeUpstash(), now: () => t });
    const c = await s.add("ep:9", nc());
    expect((await s.list("ep:9"))[0].id).toBe(c.id);
    for (const r of ["r1", "r2", "r2"]) await s.report(c.id, "x", r);
    expect((await s.list("ep:9"))[0].hidden).toBeUndefined();
    expect(await s.report(c.id, "x", "r3")).toEqual({ hidden: true });
    expect((await s.list("ep:9"))[0].hidden).toBe(true);
    await s.react("ep:9", "sad", "a1");
    const counts: ReactionCounts = await s.react("ep:9", "angry", "a1");
    expect(counts.sad).toBe(0);
    expect(counts.angry).toBe(1);
    for (let i = 1; i < RATE_LIMIT_MAX; i++) await s.add("ep:9", nc());
    await expect(s.add("ep:9", nc())).rejects.toBeInstanceOf(RateLimitError);
    t += 60_000;
    await expect(s.add("ep:9", nc())).resolves.toBeTruthy();
  });
});

describe("route handlers", () => {
  const ctx = (episodeId: string) => ({ params: Promise.resolve({ episodeId }) });
  const post = (episodeId: string, body: unknown) =>
    POST(new Request(`http://x/api/threads/${episodeId}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), ctx(episodeId));
  const get = (episodeId: string) => GET(new Request(`http://x/api/threads/${episodeId}`), ctx(episodeId));
  const report = (body: unknown) => REPORT(new Request("http://x/api/report", { method: "POST", body: JSON.stringify(body) }));

  it("validates episodeId", async () => {
    expect((await get("BAD ID")).status).toBe(400);
    expect((await get("ab")).status).toBe(400);
    expect((await post("x".repeat(81), { reaction: "love", authorId: freshId() })).status).toBe(400);
  });

  it("creates a comment (201) with cleaned body and returns it on GET", async () => {
    const ep = `route:${Date.now()}a`;
    const res = await post(ep, { body: "  wow\u0000  ok ", author: " Bo ", authorId: freshId(), spoiler: true });
    expect(res.status).toBe(201);
    const c = (await res.json()) as Comment;
    expect(c.body).toBe("wow ok");
    expect(c.author).toBe("Bo");
    expect(c.spoiler).toBe(true);
    const g = (await (await get(ep)).json()) as { comments: Comment[]; reactions: ReactionCounts };
    expect(g.comments.map((x) => x.id)).toEqual([c.id]);
    expect(g.reactions.love).toBe(0);
  });

  it("rejects invalid comment bodies with 400", async () => {
    const ep = `route:${Date.now()}b`;
    const a = freshId();
    expect((await post(ep, "{not json")).status).toBe(400);
    expect((await post(ep, [1])).status).toBe(400);
    expect((await post(ep, { body: "hi", author: "A", authorId: "short", spoiler: false })).status).toBe(400);
    expect((await post(ep, { body: "hi", author: "x".repeat(41), authorId: a, spoiler: false })).status).toBe(400);
    expect((await post(ep, { body: "hi", author: "A", authorId: a })).status).toBe(400);
    expect((await post(ep, { body: "   ", author: "A", authorId: a, spoiler: false })).status).toBe(400);
    expect((await post(ep, { body: "free crypto", author: "A", authorId: a, spoiler: false })).status).toBe(400);
    expect((await post(ep, { reaction: "meh", authorId: a })).status).toBe(400);
  });

  it("validates gif urls against https + host allowlist", async () => {
    const ep = `route:${Date.now()}c`;
    const gif = (url: string) => ({ body: "lol", author: "A", authorId: freshId(), spoiler: false, gif: { url, width: 200, height: 150, provider: "giphy" } });
    expect((await post(ep, gif("https://media.giphy.com/media/abc/giphy.gif"))).status).toBe(201);
    expect((await post(ep, gif("https://media.tenor.com/x.gif"))).status).toBe(201);
    expect((await post(ep, gif("https://static.klipy.com/x.gif"))).status).toBe(201);
    expect((await post(ep, gif("http://media.giphy.com/x.gif"))).status).toBe(400);
    expect((await post(ep, gif("https://evil.com/x.gif"))).status).toBe(400);
    expect((await post(ep, gif("https://klipy.com.evil.com/x.gif"))).status).toBe(400);
    expect((await post(ep, gif("https://evilklipy.com/x.gif"))).status).toBe(400);
    expect((await post(ep, gif("https://user:pw@media.giphy.com/x.gif"))).status).toBe(400);
    expect((await post(ep, gif("javascript:alert(1)"))).status).toBe(400);
  });

  it("returns 429 after 5 comments/min for the same author", async () => {
    const ep = `route:${Date.now()}d`;
    const a = freshId();
    for (let i = 0; i < 5; i++) expect((await post(ep, { body: `m${i}`, author: "A", authorId: a, spoiler: false })).status).toBe(201);
    const res = await post(ep, { body: "m6", author: "A", authorId: a, spoiler: false });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("handles reactions with switching (200 ReactionCounts)", async () => {
    const ep = `route:${Date.now()}e`;
    const a = freshId();
    let r = await post(ep, { reaction: "love", authorId: a });
    expect(r.status).toBe(200);
    r = await post(ep, { reaction: "shocked", authorId: a });
    const counts = (await r.json()) as ReactionCounts;
    expect(counts.love).toBe(0);
    expect(counts.shocked).toBe(1);
  });

  it("report route: validates, dedupes reporters, hides at 3, GET filters hidden", async () => {
    const ep = `route:${Date.now()}f`;
    const c = (await (await post(ep, { body: "spoilery", author: "A", authorId: freshId(), spoiler: false })).json()) as Comment;
    const base = { commentId: c.id, episodeId: ep, reason: "spam" };
    expect((await report({ ...base, reporterId: "x" })).status).toBe(400);
    expect((await report({ ...base, episodeId: "other:ep", reporterId: freshId() })).status).toBe(404);
    expect((await report({ ...base, commentId: "missing-id", reporterId: freshId() })).status).toBe(404);
    const r1 = freshId();
    expect(await (await report({ ...base, reporterId: r1 })).json()).toEqual({ ok: true, hidden: false });
    await report({ ...base, reporterId: r1 });
    await report({ ...base, reporterId: freshId() });
    expect(((await (await get(ep)).json()) as { comments: Comment[] }).comments).toHaveLength(1);
    expect(await (await report({ ...base, reporterId: freshId() })).json()).toEqual({ ok: true, hidden: true });
    expect(((await (await get(ep)).json()) as { comments: Comment[] }).comments).toHaveLength(0);
  });
});
