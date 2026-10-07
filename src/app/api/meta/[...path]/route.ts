import { META_TTL, serverProvider } from "@/lib/meta";
import type { ExternalIds } from "@/lib/types";

const showId = /^tvmaze:\d+$/;
const movieId = /^(tmdb:\d+|imdb:tt\d+)$/;
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const badRequest = () => Response.json({ error: "Invalid metadata request" }, { status: 400 });

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const [action, id] = path;
  const params = new URL(request.url).searchParams;
  let result: unknown;
  let ttl: number;
  try {
    const provider = serverProvider();
    if (path.length === 2 && ["show", "episodes", "movie"].includes(action)) {
      if (!(action === "movie" ? movieId : showId).test(id)) return badRequest();
      if (action === "show") { result = await provider.getShow(id); ttl = META_TTL.show; }
      else if (action === "movie") { result = await provider.getMovie(id); ttl = META_TTL.movie; }
      else { result = await provider.getEpisodes(id); ttl = META_TTL.episodes; }
    } else if (path.length === 1 && action === "search") {
      const query = params.get("q")?.trim();
      if (!query || query.length > 500) return badRequest();
      result = await provider.search(query); ttl = META_TTL.search;
    } else if (path.length === 1 && action === "resolve") {
      const kind = params.get("kind");
      if (kind !== "show" && kind !== "movie") return badRequest();
      const ids: ExternalIds = {};
      const imdb = params.get("imdb");
      if (imdb !== null) {
        if (!/^tt\d+$/.test(imdb)) return badRequest();
        ids.imdb = imdb;
      }
      for (const key of ["tvdb", "tmdb", "tvmaze"] as const) {
        const value = params.get(key);
        if (value !== null) {
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) return badRequest();
          ids[key] = Number(value);
        }
      }
      const title = params.get("title") ?? "";
      const year = params.get("year");
      if (title.length > 500 || (!title.trim() && !Object.keys(ids).length) || (year !== null && !/^\d{4}$/.test(year))) return badRequest();
      result = await provider.resolve(kind, ids, title, year === null ? undefined : Number(year)); ttl = META_TTL.resolve;
    } else if (path.length === 1 && action === "schedule") {
      const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
      const from = params.get("from") ?? "";
      const to = params.get("to") ?? "";
      if (ids.length > 100 || ids.some((id) => !showId.test(id)) || !validDate(from) || !validDate(to) || from > to) return badRequest();
      result = await provider.schedule(ids, from, to); ttl = META_TTL.schedule;
    } else {
      return Response.json({ error: "Metadata endpoint not found" }, { status: 404 });
    }
    return Response.json(result, { headers: { "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=86400` } });
  } catch {
    return Response.json({ error: "Metadata service unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
