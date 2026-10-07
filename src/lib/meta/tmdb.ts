import type { Episode, ExternalIds, Movie, Show } from "../types";
import type { MetadataProvider, SearchResult } from "./types";
import { bestMatch, inDateRange, plainSummary, releaseYear } from "./tvmaze";

interface TmdbTitle {
  id: number; media_type?: string; title?: string; name?: string;
  release_date?: string; first_air_date?: string; poster_path?: string | null;
  backdrop_path?: string | null; overview?: string; runtime?: number | null;
  episode_run_time?: number[]; status?: string; genres?: { name: string }[];
  networks?: { name: string }[]; seasons?: { season_number: number }[];
  imdb_id?: string | null; external_ids?: { imdb_id?: string | null; tvdb_id?: number | null };
}
interface TmdbEpisode {
  season_number: number; episode_number: number; name?: string;
  air_date?: string; runtime?: number | null; overview?: string; still_path?: string | null;
}
const image = (path?: string | null) => path ? `https://image.tmdb.org/t/p/w342${path}` : undefined;
const externalIds = (item: TmdbTitle): ExternalIds => ({
  tmdb: item.id, imdb: item.external_ids?.imdb_id ?? item.imdb_id ?? undefined,
  tvdb: item.external_ids?.tvdb_id ?? undefined,
});

export function createTmdb(apiKey: string, fetchImpl: typeof fetch = fetch): MetadataProvider {
  async function request<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    const query = new URLSearchParams({ ...params, api_key: apiKey });
    const response = await fetchImpl(`https://api.themoviedb.org/3/${path}?${query}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`TMDB request failed (${response.status})`);
    return await response.json() as T;
  }
  const provider: MetadataProvider = {
    async search(query) {
      if (!query.trim()) return [];
      const data = await request<{ results: TmdbTitle[] }>("search/multi", { query });
      return (data?.results ?? []).filter((item) => item.media_type === "movie" || item.media_type === "tv").map((item): SearchResult => ({
        kind: item.media_type === "movie" ? "movie" : "show", id: `tmdb:${item.id}`,
        title: item.title ?? item.name ?? "", year: releaseYear(item.release_date ?? item.first_air_date),
        poster: image(item.poster_path), ids: externalIds(item),
      }));
    },
    async getShow(id): Promise<Show | null> {
      if (!/^tmdb:\d+$/.test(id)) return null;
      const item = await request<TmdbTitle>(`tv/${id.slice(5)}`, { append_to_response: "external_ids" });
      if (!item) return null;
      return { id, kind: "show", title: item.name ?? "", year: releaseYear(item.first_air_date),
        ids: externalIds(item), poster: image(item.poster_path), backdrop: image(item.backdrop_path),
        summary: plainSummary(item.overview), runtime: item.episode_run_time?.[0],
        status: item.status === "Ended" || item.status === "Canceled" ? "ended" : item.status === "Returning Series" ? "running" : "unknown",
        network: item.networks?.[0]?.name, genres: item.genres?.map((genre) => genre.name), fetchedAt: Date.now() };
    },
    async getEpisodes(showId): Promise<Episode[]> {
      if (!/^tmdb:\d+$/.test(showId)) return [];
      const item = await request<TmdbTitle>(`tv/${showId.slice(5)}`);
      const episodes: Episode[] = [];
      for (const season of item?.seasons ?? []) {
        const data = await request<{ episodes: TmdbEpisode[] }>(`tv/${showId.slice(5)}/season/${season.season_number}`);
        for (const episode of data?.episodes ?? []) episodes.push({
          id: `${showId}:s${episode.season_number}e${episode.episode_number}`, showId,
          season: episode.season_number, number: episode.episode_number, title: episode.name,
          airdate: episode.air_date || undefined, runtime: episode.runtime ?? undefined,
          summary: plainSummary(episode.overview), image: image(episode.still_path),
        });
      }
      return episodes;
    },
    async getMovie(id): Promise<Movie | null> {
      if (/^imdb:tt\d+$/.test(id)) {
        const found = await request<{ movie_results: TmdbTitle[] }>(`find/${id.slice(5)}`, { external_source: "imdb_id" });
        const movie = found?.movie_results[0];
        return movie ? provider.getMovie(`tmdb:${movie.id}`) : null;
      }
      if (!/^tmdb:\d+$/.test(id)) return null;
      const item = await request<TmdbTitle>(`movie/${id.slice(5)}`);
      return item ? { id, kind: "movie", title: item.title ?? "", year: releaseYear(item.release_date),
        ids: externalIds(item), poster: image(item.poster_path), summary: plainSummary(item.overview),
        runtime: item.runtime ?? undefined, releaseDate: item.release_date || undefined, fetchedAt: Date.now() } : null;
    },
    async resolve(kind, ids, title, year) {
      if (ids.tmdb !== undefined) {
        const item = await (kind === "movie" ? provider.getMovie : provider.getShow)(`tmdb:${ids.tmdb}`);
        if (item) return item.id;
      }
      for (const [source, value] of [["imdb_id", ids.imdb], ["tvdb_id", kind === "show" ? ids.tvdb : undefined]] as const) {
        if (value === undefined) continue;
        const found = await request<{ movie_results: TmdbTitle[]; tv_results: TmdbTitle[] }>(`find/${encodeURIComponent(value)}`, { external_source: source });
        const item = (kind === "movie" ? found?.movie_results : found?.tv_results)?.[0];
        if (item) return `tmdb:${item.id}`;
      }
      return bestMatch((await provider.search(title)).filter((item) => item.kind === kind), title, year);
    },
    async schedule(ids, from, to) {
      return inDateRange((await Promise.all([...new Set(ids)].map(provider.getEpisodes))).flat(), from, to);
    },
  };
  return provider;
}
