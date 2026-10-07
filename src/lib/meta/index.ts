import { db } from "../db";
import type { Episode, Movie, Show } from "../types";
import type { MetadataProvider, SearchResult } from "./types";
import { createTvmaze } from "./tvmaze";
import { createTmdb } from "./tmdb";

export const META_TTL = { show: 86400, movie: 86400, episodes: 43200, search: 3600, schedule: 10800, resolve: 86400 } as const;
let server: MetadataProvider | undefined;
export function serverProvider(): MetadataProvider {
  if (typeof window !== "undefined") throw new Error("Server metadata provider is unavailable in the browser");
  if (server) return server;
  const maze = createTvmaze();
  const key = process.env.TMDB_API_KEY;
  if (!key) return server = maze;
  const tmdb = createTmdb(key);
  server = {
    async search(query) {
      const [shows, titles] = await Promise.all([maze.search(query), tmdb.search(query)]);
      return [...shows, ...titles.filter((item) => item.kind === "movie")];
    },
    getShow: (id) => id.startsWith("tmdb:") ? tmdb.getShow(id) : maze.getShow(id),
    getEpisodes: (id) => id.startsWith("tmdb:") ? tmdb.getEpisodes(id) : maze.getEpisodes(id),
    getMovie: tmdb.getMovie,
    async resolve(kind, ids, title, year) {
      if (kind === "movie") return tmdb.resolve(kind, ids, title, year);
      if (ids.tmdb !== undefined && ids.tvmaze === undefined && ids.imdb === undefined && ids.tvdb === undefined) {
        const show = await tmdb.getShow(`tmdb:${ids.tmdb}`);
        if (show) return maze.resolve(kind, show.ids, title || show.title, year ?? show.year);
      }
      return maze.resolve(kind, ids, title, year);
    },
    async schedule(ids, from, to) {
      const groups = await Promise.all([
        maze.schedule(ids.filter((id) => id.startsWith("tvmaze:")), from, to),
        tmdb.schedule(ids.filter((id) => id.startsWith("tmdb:")), from, to),
      ]);
      return groups.flat().sort((a, b) => a.airdate!.localeCompare(b.airdate!));
    },
  };
  return server;
}

export function clientProvider(): MetadataProvider {
  const pending = new Map<string, Promise<unknown>>();
  async function cached<T>(path: string, ttl: number, persist?: (value: T) => Promise<void>): Promise<T> {
    const database = db();
    const key = `meta:${path}`;
    const row = await database.cache.get(key);
    if (row && row.expiresAt > Date.now()) return row.value as T;
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    const request = (async () => {
      const response = await fetch(`/api/meta/${path}`);
      if (!response.ok) throw new Error(`Metadata request failed (${response.status})`);
      const value = await response.json() as T;
      await database.transaction("rw", [database.cache, database.shows, database.episodes, database.movies], async () => {
        if (persist) await persist(value);
        await database.cache.put({ key, value, expiresAt: Date.now() + ttl * 1000 });
      });
      return value;
    })();
    pending.set(key, request);
    try { return await request; }
    finally { pending.delete(key); }
  }
  const saveEpisodes = async (episodes: Episode[]) => { await db().episodes.bulkPut(episodes); };
  return {
    search: (q) => cached<SearchResult[]>(`search?${new URLSearchParams({ q })}`, META_TTL.search),
    getShow: (id) => cached<Show | null>(`show/${encodeURIComponent(id)}`, META_TTL.show, async (show) => { if (show) await db().shows.put(show); }),
    getEpisodes: (id) => cached<Episode[]>(`episodes/${encodeURIComponent(id)}`, META_TTL.episodes, saveEpisodes),
    getMovie: (id) => cached<Movie | null>(`movie/${encodeURIComponent(id)}`, META_TTL.movie, async (movie) => { if (movie) await db().movies.put(movie); }),
    resolve(kind, ids, title, year) {
      const params = new URLSearchParams({ kind, title });
      if (year !== undefined) params.set("year", String(year));
      for (const key of ["imdb", "tvdb", "tmdb", "tvmaze"] as const) {
        if (ids[key] !== undefined) params.set(key, String(ids[key]));
      }
      return cached<string | null>(`resolve?${params}`, META_TTL.resolve);
    },
    schedule(ids, from, to) {
      const params = new URLSearchParams({ ids: [...new Set(ids)].sort().join(","), from, to });
      return cached<Episode[]>(`schedule?${params}`, META_TTL.schedule, saveEpisodes);
    },
  };
}
