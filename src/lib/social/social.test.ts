import { describe, expect, it } from "vitest";
import { HIDE_AT_REPORTS, moderate } from "./moderation";
import { createMemoryStore, createRedisStore, RateLimitError, NotFoundError, RATE_LIMIT_MAX, LIST_LIMIT, type PagedThreadStore } from "./store";
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

function fakeUpstash() {
  const kv = new Map<string, string>();
  const zsets = new Map<string, Map<string, number>>();
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
      case "ZADD": { const z = zsets.get(k) ?? new Map(); z.set(a[1], Number(a[0])); zsets.set(k, z); return 1; }
      case "ZCARD": return zsets.get(k)?.size ?? 0;
      case "ZREM": { const z = zsets.get(k); let n = 0; for (const m of a) if (z?.delete(m)) n++; return n; }
      case "ZRANGE": {
        const sorted = [...(zsets.get(k) ?? new Map<string, number>())].sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : 1));
        if (a.includes("BYSCORE")) {
          const rev = a.includes("REV");
          const bound = (x: string) => {
            const ex = x.startsWith("("); const v = ex ? x.slice(1) : x;
            return { v: v === "+inf" ? Infinity : v === "-inf" ? -Infinity : Number(v), ex };
          };
          const hi = bound(rev ? a[0] : a[1]); const lo = bound(rev ? a[1] : a[0]);
          let out = sorted.filter(([, sc]) => (hi.ex ? sc < hi.v : sc <= hi.v) && (lo.ex ? sc > lo.v : sc >= lo.v));
          if (rev) out = out.reverse();
          const li = a.indexOf("LIMIT");
          if (li >= 0) out = out.slice(Number(a[li + 1]), Number(a[li + 1]) + Number(a[li + 2]));
          return out.map(([m]) => m);
        }
        const n = sorted.length; const norm = (i: number) => (i < 0 ? Math.max(0, n + i) : i);
        return sorted.slice(norm(Number(a[0])), norm(Number(a[1])) + 1).map(([m]) => m);
      }
      case "SREM": { const st = sets.get(k); let n = 0; for (const m of a) if (st?.delete(m)) n++; return n; }
      case "DEL": { let n = 0; for (const x of [k, ...a]) { if (kv.delete(x)) n++; if (sets.delete(x)) n++; } return n; }
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
  return { fetchImpl, kv, sets, zsets };
}

describe("redis store (fake fetch)", () => {
  it("supports add/list/report/react semantics", async () => {
    let t = 5_000_000;
    const s = createRedisStore({ url: "https://x.upstash.io/", token: "t", fetchImpl: fakeUpstash().fetchImpl, now: () => t });
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

async function drain(s: PagedThreadStore, ep: string, limit: number): Promise<string[]> {
  const seen: string[] = [];
  let before: number | undefined;
  for (let guard = 0; guard < 100; guard++) {
    const page = await s.listPage(ep, before, limit);
    seen.unshift(...page.comments.map((c) => c.body));
    if (page.nextBefore === undefined) return seen;
    expect(page.comments.length).toBeGreaterThan(0);
    before = page.nextBefore;
  }
  throw new Error("pagination did not terminate");
}

describe("pagination + retention", () => {
  // Timestamps with deliberate ties so page boundaries split same-ms groups.
  const stamps = [1, 2, 2, 2, 3, 4, 4, 5, 6, 6, 6, 6, 7];
  function memoryWithStamps() {
    let i = 0;
    const s = createMemoryStore({ now: () => stamps[Math.min(i, stamps.length - 1)] * 1000 });
    return { s, tick: () => { i++; } };
  }

  it("memory: list() returns the newest LIST_LIMIT; listPage walks everything in order without loss", async () => {
    let t = 1_000;
    const s = createMemoryStore({ now: () => (t += 7) });
    for (let i = 0; i < LIST_LIMIT + 30; i++) await s.add("ep:big", nc({ body: `c${i}`, authorId: `author-${i}-xx` }));
    const list = await s.list("ep:big");
    expect(list).toHaveLength(LIST_LIMIT);
    expect(list[0].body).toBe("c30");
    const first = await s.listPage("ep:big");
    expect(first.comments).toHaveLength(50);
    expect(await drain(s, "ep:big", 50)).toEqual(Array.from({ length: LIST_LIMIT + 30 }, (_, i) => `c${i}`));
  });

  it("memory: ties on createdAt across page boundaries are not skipped or duplicated", async () => {
    const { s, tick } = memoryWithStamps();
    for (let i = 0; i < stamps.length; i++) { await s.add("ep:tie", nc({ body: `t${i}`, authorId: `author-${i}-xx` })); tick(); }
    const expected = stamps.map((_, i) => `t${i}`);
    for (const limit of [1, 2, 3, 4, 5, 50]) expect(await drain(s, "ep:tie", limit)).toEqual(expected);
  });

  it("memory: retention evicts oldest and its data; evicted comments are not reportable", async () => {
    const s = createMemoryStore({ retention: 3 });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await s.add("ep:r", nc({ body: `r${i}`, authorId: `author-${i}-xx` }))).id);
    expect((await s.list("ep:r")).map((c) => c.body)).toEqual(["r2", "r3", "r4"]);
    expect(await s.get(ids[0])).toBeNull();
    expect((await s.get(ids[4]))?.body).toBe("r4");
    await expect(s.report(ids[0], "x", "rep")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("redis: listPage with ties, retention deletes trimmed keys", async () => {
    const fake = fakeUpstash();
    let i = 0;
    const s = createRedisStore({ url: "https://x.upstash.io", token: "t", fetchImpl: fake.fetchImpl, now: () => stamps[Math.min(i, stamps.length - 1)] * 1000, retention: 10 });
    const ids: string[] = [];
    for (let k = 0; k < stamps.length; k++) { ids.push((await s.add("ep:rt", nc({ body: `t${k}`, authorId: `author-${k}-xx` }))).id); i++; }
    // 13 added, retention 10 -> the 3 lowest-scored evicted (Redis orders same-ms ties by member).
    const zset = fake.zsets.get("ep:zthread:ep:rt") ?? new Map<string, number>();
    const retained = ids.filter((id) => zset.has(id));
    const evicted = ids.filter((id) => !zset.has(id));
    expect(retained).toHaveLength(10);
    expect(evicted).toHaveLength(3);
    const retainedBodies = ids.map((_, k) => `t${k}`).filter((_, k) => zset.has(ids[k]));
    for (const limit of [1, 2, 3, 50]) {
      const seen = await drain(s, "ep:rt", limit);
      expect([...seen].sort()).toEqual([...retainedBodies].sort());
      const ts = seen.map((b) => stamps[Number(b.slice(1))]);
      expect(ts).toEqual([...ts].sort((x, y) => x - y));
    }
    const minRetained = Math.min(...retained.map((id) => zset.get(id) ?? 0));
    for (const id of evicted) {
      expect(stamps[ids.indexOf(id)] * 1000).toBeLessThanOrEqual(minRetained);
      expect(fake.kv.has(`ep:comment:${id}`)).toBe(false);
      expect(await s.get(id)).toBeNull();
      await expect(s.report(id, "x", "rep-1")).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(fake.zsets.get("ep:zthread:ep:rt")?.size).toBe(10);
    for (const r of ["a", "b", "c"]) await s.report(ids[5], "x", `rep-${r}`);
    expect(fake.sets.get("ep:hidden:ep:rt")?.has(ids[5])).toBe(true);
    // push enough to evict ids[5]; its reporter set and hidden membership must be cleaned up
    for (let k = 0; k < 8; k++) await s.add("ep:rt", nc({ body: `n${k}`, authorId: `late-author-${k}` }));
    expect(fake.kv.has(`ep:comment:${ids[5]}`)).toBe(false);
    expect(fake.sets.has(`ep:reporters:${ids[5]}`)).toBe(false);
    expect(fake.sets.get("ep:hidden:ep:rt")?.has(ids[5])).toBe(false);
    expect(fake.zsets.get("ep:zthread:ep:rt")?.size).toBe(10);
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

  it("GET paginates with ?before and returns nextBefore; validates params", async () => {
    const ep = `route:${Date.now()}g`;
    for (let i = 0; i < 4; i++) await post(ep, { body: `p${i}`, author: "A", authorId: freshId(), spoiler: false });
    const pageReq = (qs: string) => GET(new Request(`http://x/api/threads/${ep}${qs}`), ctx(ep));
    type Page = { comments: Comment[]; nextBefore?: number };
    const all = (await (await pageReq("")).json()) as Page;
    expect(all.comments.map((c) => c.body)).toEqual(["p0", "p1", "p2", "p3"]);
    expect(all.nextBefore).toBeUndefined();
    // Comments share a ms here; paginate until exhausted and ensure everything is seen exactly once.
    const seen: string[] = [];
    let qs = "?limit=1";
    for (let g = 0; g < 10; g++) {
      const p = (await (await pageReq(qs)).json()) as Page;
      seen.unshift(...p.comments.map((c) => c.body));
      if (p.nextBefore === undefined) break;
      qs = `?limit=1&before=${p.nextBefore}`;
    }
    expect(seen).toEqual(["p0", "p1", "p2", "p3"]);
    expect((await pageReq("?before=abc")).status).toBe(400);
    expect((await pageReq("?before=-1")).status).toBe(400);
    expect((await pageReq("?limit=0")).status).toBe(400);
    expect((await pageReq("?limit=201")).status).toBe(400);
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
