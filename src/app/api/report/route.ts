import { z } from "zod";
import { moderate } from "@/lib/social/moderation";
import { getThreadStore, NotFoundError } from "@/lib/social/store";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 4096;

const reportSchema = z.object({
  commentId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
  episodeId: z.string().regex(/^[a-z0-9:]{3,80}$/),
  reason: z.string().max(500),
  reporterId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  let value: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_REQUEST_BYTES) return json({ error: "invalid_json" }, 400);
    value = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const p = reportSchema.safeParse(value);
  if (!p.success) return json({ error: "invalid_report" }, 400);
  // Reason is free text from the client; clean it but never reject a report for its wording.
  const reason = moderate(p.data.reason).clean.slice(0, 500) || "unspecified";
  try {
    const store = getThreadStore();
    const comments = await store.list(p.data.episodeId);
    if (!comments.some((c) => c.id === p.data.commentId)) return json({ error: "not_found" }, 404);
    const { hidden } = await store.report(p.data.commentId, reason, p.data.reporterId);
    return json({ ok: true, hidden });
  } catch (e) {
    if (e instanceof NotFoundError) return json({ error: "not_found" }, 404);
    throw e;
  }
}
