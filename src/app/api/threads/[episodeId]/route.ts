import { z } from "zod";
import { REACTIONS } from "@/lib/social/types";
import { moderate } from "@/lib/social/moderation";
import { getThreadStore, PAGE_MAX, RateLimitError } from "@/lib/social/store";

export const dynamic = "force-dynamic";

const EPISODE_ID_RE = /^[a-z0-9:]{3,80}$/;
const MAX_REQUEST_BYTES = 16_384;
const GIF_HOSTS = new Set(["media.giphy.com", "media.tenor.com"]);

function isAllowedGifUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  return GIF_HOSTS.has(host) || (host.endsWith(".klipy.com") && host.length > ".klipy.com".length);
}

const authorId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

const gifSchema = z.object({
  url: z.string().max(2048).refine(isAllowedGifUrl, "gif url not allowed"),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  provider: z.string().min(1).max(20).regex(/^[a-z0-9_-]+$/i),
});

const commentSchema = z.object({
  body: z.string().max(4000),
  author: z.string().min(1).max(40),
  authorId,
  spoiler: z.boolean(),
  gif: gifSchema.optional(),
});

const reactionSchema = z.object({ reaction: z.enum(REACTIONS), authorId });

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function bad(error: string, status = 400): Response {
  return json({ error }, status);
}

async function readJson(req: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const text = await req.text();
    if (text.length > MAX_REQUEST_BYTES) return { ok: false };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

type Ctx = { params: Promise<{ episodeId: string }> };

function parseIntParam(v: string | null, min: number, max: number): number | undefined | null {
  if (v === null) return undefined;
  if (!/^\d{1,16}$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** GET ?before=<createdAt>&limit=<1..PAGE_MAX> -> {comments (ascending, hidden removed), reactions, nextBefore?} */
export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { episodeId } = await ctx.params;
  if (!EPISODE_ID_RE.test(episodeId)) return bad("invalid_episode");
  const sp = new URL(req.url).searchParams;
  const before = parseIntParam(sp.get("before"), 1, Number.MAX_SAFE_INTEGER);
  const limit = parseIntParam(sp.get("limit"), 1, PAGE_MAX);
  if (before === null) return bad("invalid_before");
  if (limit === null) return bad("invalid_limit");
  const store = getThreadStore();
  const [page, reactions] = await Promise.all([store.listPage(episodeId, before, limit), store.reactions(episodeId)]);
  const comments = page.comments.filter((c) => !c.hidden);
  return json(page.nextBefore === undefined ? { comments, reactions } : { comments, reactions, nextBefore: page.nextBefore });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { episodeId } = await ctx.params;
  if (!EPISODE_ID_RE.test(episodeId)) return bad("invalid_episode");
  const parsed = await readJson(req);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return bad("invalid_json");
  }
  const store = getThreadStore();

  if ("reaction" in parsed.value) {
    const r = reactionSchema.safeParse(parsed.value);
    if (!r.success) return bad("invalid_reaction");
    const counts = await store.react(episodeId, r.data.reaction, r.data.authorId);
    return json(counts, 200);
  }

  const c = commentSchema.safeParse(parsed.value);
  if (!c.success) return bad("invalid_comment");
  const body = moderate(c.data.body);
  if (!body.ok) return bad(`body_${body.reason ?? "rejected"}`);
  const author = moderate(c.data.author);
  if (!author.ok || author.clean.length > 40 || author.clean.includes("\n")) {
    return bad(`author_${author.reason ?? "invalid"}`);
  }
  try {
    const comment = await store.add(episodeId, {
      body: body.clean,
      author: author.clean,
      authorId: c.data.authorId,
      spoiler: c.data.spoiler,
      gif: c.data.gif,
    });
    return json(comment, 201);
  } catch (e) {
    if (e instanceof RateLimitError) return json({ error: "rate_limited" }, 429, { "Retry-After": String(e.retryAfterSec) });
    throw e;
  }
}
