import type { Episode, Show } from "../types";
import type { MetadataProvider, SearchResult } from "./types";

interface MazeShow {
  id: number;
  name: string;
  premiered?: string | null;
  summary?: string | null;
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  genres?: string[];
  image?: { medium?: string; original?: string } | null;
  network?: { name: string } | null;
  webChannel?: { name: string } | null;
  externals?: { imdb?: string | null; thetvdb?: number | null };
}
interface MazeEpisode {
  id: number;
  season: number;
  number: number | null;
  name?: string;
  airdate?: string;
  airstamp?: string | null;
  runtime?: number | null;
  summary?: string | null;
  image?: { medium?: string; original?: string } | null;
}

export const plainSummary = (value?: string | null): string | undefined =>
  value == null ? undefined : value.replace(/<[^>]*>/g, "").trim();
export const releaseYear = (date?: string | null): number | undefined =>
  date && /^\d{4}-/.test(date) ? Number(date.slice(0, 4)) : undefined;
export function bestMatch(results: SearchResult[], title: string, year?: number): string | null {
  const exact = results.filter((item) => item.title.toLowerCase() === title.trim().toLowerCase());
  const candidates = exact.length ? exact : results;
  return (candidates.find((item) => year !== undefined && item.year === year) ?? candidates[0])?.id ?? null;
}
export function inDateRange(episodes: Episode[], from: string, to: string): Episode[] {
  return episodes.filter((episode) => episode.airdate && episode.airdate >= from && episode.airdate <= to)
    .sort((a, b) => a.airdate!.localeCompare(b.airdate!));
}
function mapShow(show: MazeShow): Show {
  return {
    id: `tvmaze:${show.id}`, kind: "show", title: show.name,
    year: releaseYear(show.premiered),
    ids: { tvmaze: show.id, imdb: show.externals?.imdb ?? undefined, tvdb: show.externals?.thetvdb ?? undefined },
    poster: show.image?.medium ?? show.image?.original,
    summary: plainSummary(show.summary),
    status: show.status === "Running" ? "running" : show.status === "Ended" ? "ended" : show.status === "To Be Determined" ? "tbd" : "unknown",
    network: show.network?.name ?? show.webChannel?.name,
    genres: show.genres, runtime: show.runtime ?? show.averageRuntime ?? undefined, fetchedAt: Date.now(),
  };
}

export function createTvmaze(fetchImpl: typeof fetch = fetch): MetadataProvider {
  let tokens = 20;
  let updated = Date.now();
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  async function acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      tokens = Math.min(20, tokens + (now - updated) / 500);
      updated = now;
      if (tokens >= 1) { tokens -= 1; return; }
      await sleep(Math.ceil((1 - tokens) * 500));
    }
  }
  async function request<T>(path: string): Promise<T | null> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await acquire();
      const response = await fetchImpl(`https://api.tvmaze.com/${path}`);
      if (response.status === 404) return null;
      if (response.status === 429 && attempt < 3) {
        const retry = response.headers.get("Retry-After");
        const delay = retry === null ? NaN : /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
        await sleep(Number.isFinite(delay) ? Math.max(0, delay) : 1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error(`TVmaze request failed (${response.status})`);
      return await response.json() as T;
    }
    throw new Error("TVmaze retry limit exceeded");
  }
  const provider: MetadataProvider = {
    async search(query) {
      if (!query.trim()) return [];
      const rows = await request<{ show: MazeShow }[]>(`search/shows?${new URLSearchParams({ q: query })}`);
      return (rows ?? []).map(({ show }) => mapShow(show));
    },
    async getShow(id) {
      if (!/^tvmaze:\d+$/.test(id)) return null;
      const show = await request<MazeShow>(`shows/${id.slice(7)}`);
      return show ? mapShow(show) : null;
    },
    async getEpisodes(showId) {
      if (!/^tvmaze:\d+$/.test(showId)) return [];
      const episodes = await request<MazeEpisode[]>(`shows/${showId.slice(7)}/episodes?specials=1`);
      return (episodes ?? []).filter((episode) => episode.number !== null).map((episode) => ({
        id: `${showId}:s${episode.season}e${episode.number}`, showId,
        season: episode.season, number: episode.number!, title: episode.name,
        airdate: episode.airdate || undefined, airstamp: episode.airstamp || undefined,
        runtime: episode.runtime ?? undefined, summary: plainSummary(episode.summary),
        image: episode.image?.medium ?? episode.image?.original, tvmazeId: episode.id,
      }));
    },
    async getMovie() { return null; },
    async resolve(kind, ids, title, year) {
      if (kind === "movie") return null;
      if (ids.tvmaze !== undefined) {
        const show = await provider.getShow(`tvmaze:${ids.tvmaze}`);
        if (show) return show.id;
      }
      for (const [key, value] of [["imdb", ids.imdb], ["thetvdb", ids.tvdb]] as const) {
        if (value === undefined) continue;
        const show = await request<MazeShow>(`lookup/shows?${new URLSearchParams({ [key]: String(value) })}`);
        if (show) return `tvmaze:${show.id}`;
      }
      return bestMatch(await provider.search(title), title, year);
    },
    async schedule(showIds, from, to) {
      return inDateRange((await Promise.all([...new Set(showIds)].map(provider.getEpisodes))).flat(), from, to);
    },
  };
  return provider;
}
