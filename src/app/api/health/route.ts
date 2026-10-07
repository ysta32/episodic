import { version } from "../../../../package.json";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({
    ok: true,
    version,
    time: new Date().toISOString(),
    store: process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? "redis" : "memory",
    tmdb: Boolean(process.env.TMDB_API_KEY),
  }, { headers: { "Cache-Control": "no-store" } });
}
