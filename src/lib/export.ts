// Full-library export (JSON backup + CSV of watch history) and the backup schema.
import { z } from "zod";
import { db } from "./db";
import type { Episode, LibraryEntry, Movie, Rating, Settings, Show, UserList, WatchEvent } from "./types";

const externalIds = z.object({
  tvmaze: z.number().optional(),
  tmdb: z.number().optional(),
  imdb: z.string().optional(),
  tvdb: z.number().optional(),
  trakt: z.number().optional(),
  simkl: z.number().optional(),
});
const mediaKind = z.enum(["show", "movie"]);
const trackStatus = z.enum(["watching", "watchlist", "completed", "paused", "dropped"]);
const importSource = z.enum(["tvtime", "trakt", "simkl", "letterboxd", "imdb", "csv", "episodic"]);

export const libraryEntrySchema = z.object({
  id: z.string().min(1),
  kind: mediaKind,
  status: trackStatus,
  addedAt: z.number(),
  updatedAt: z.number(),
  rating: z.number().min(1).max(10).optional(),
  favorite: z.boolean().optional(),
  title: z.string(),
  ids: externalIds,
});
export const watchEventSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["episode", "movie"]),
  mediaId: z.string().min(1),
  showId: z.string().optional(),
  watchedAt: z.number(),
  source: z.union([importSource, z.literal("manual"), z.literal("scrobble")]),
});
export const ratingSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["show", "movie", "episode"]),
  mediaId: z.string().min(1),
  rating: z.number().min(1).max(10),
  ratedAt: z.number(),
});
export const userListSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  items: z.array(z.object({ kind: mediaKind, id: z.string(), title: z.string(), addedAt: z.number() })),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export const settingsSchema = z.object({
  id: z.literal("settings"),
  displayName: z.string().optional(),
  spoilerMode: z.enum(["blur", "hide", "show"]),
  supporter: z.boolean(),
  syncEnabled: z.boolean(),
  theme: z.enum(["system", "dark", "light"]),
});
const showSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("show"),
  title: z.string(),
  year: z.number().optional(),
  ids: externalIds,
  poster: z.string().optional(),
  backdrop: z.string().optional(),
  summary: z.string().optional(),
  status: z.enum(["running", "ended", "tbd", "unknown"]).optional(),
  network: z.string().optional(),
  genres: z.array(z.string()).optional(),
  runtime: z.number().optional(),
  fetchedAt: z.number(),
});
const episodeSchema = z.object({
  id: z.string().min(1),
  showId: z.string().min(1),
  season: z.number(),
  number: z.number(),
  title: z.string().optional(),
  airdate: z.string().optional(),
  airstamp: z.string().optional(),
  runtime: z.number().optional(),
  summary: z.string().optional(),
  image: z.string().optional(),
  tvmazeId: z.number().optional(),
});
const movieSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("movie"),
  title: z.string(),
  year: z.number().optional(),
  ids: externalIds,
  poster: z.string().optional(),
  summary: z.string().optional(),
  runtime: z.number().optional(),
  releaseDate: z.string().optional(),
  fetchedAt: z.number(),
});

export const backupSchema = z.object({
  format: z.literal("episodic-backup"),
  version: z.literal(1),
  exportedAt: z.number(),
  library: z.array(libraryEntrySchema),
  watches: z.array(watchEventSchema),
  ratings: z.array(ratingSchema),
  lists: z.array(userListSchema),
  settings: settingsSchema.nullable(),
  // Metadata cache (optional superset of the contract format): lets a restored library work offline.
  shows: z.array(showSchema).optional(),
  episodes: z.array(episodeSchema).optional(),
  movies: z.array(movieSchema).optional(),
});

export interface EpisodicBackup {
  format: "episodic-backup";
  version: 1;
  exportedAt: number;
  library: LibraryEntry[];
  watches: WatchEvent[];
  ratings: Rating[];
  lists: UserList[];
  settings: Settings | null;
  shows?: Show[];
  episodes?: Episode[];
  movies?: Movie[];
}

/** Parse + validate a backup JSON string. Throws a descriptive Error when invalid. */
export function parseBackup(json: string): EpisodicBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Backup is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const res = backupSchema.safeParse(raw);
  if (!res.success) {
    const first = res.error.issues[0];
    throw new Error(`Not a valid Episodic backup: ${first ? `${first.path.join(".") || "(root)"}: ${first.message}` : "unknown error"}`);
  }
  return res.data;
}

export async function exportJson(now: number = Date.now()): Promise<string> {
  const d = db();
  const backup = await d.transaction(
    "r",
    [d.library, d.watches, d.ratings, d.lists, d.settings, d.shows, d.episodes, d.movies],
    async (): Promise<EpisodicBackup> => ({
      format: "episodic-backup",
      version: 1,
      exportedAt: now,
      library: await d.library.toArray(),
      watches: await d.watches.orderBy("watchedAt").toArray(),
      ratings: await d.ratings.toArray(),
      lists: await d.lists.toArray(),
      settings: (await d.settings.get("settings")) ?? null,
      shows: await d.shows.toArray(),
      episodes: await d.episodes.toArray(),
      movies: await d.movies.toArray(),
    }),
  );
  return JSON.stringify(backup);
}

function csvCell(v: string | number | undefined): string {
  if (v === undefined) return "";
  const s = String(v);
  // Quote when needed; neutralize spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\r\n]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const CSV_HEADER = ["type", "title", "year", "season", "episode", "watched_at", "imdb", "tvdb", "tmdb", "tvmaze", "rating"] as const;

export async function exportCsv(): Promise<string> {
  const d = db();
  const [watches, library, shows, movies, ratings, episodes] = await Promise.all([
    d.watches.orderBy("watchedAt").toArray(),
    d.library.toArray(),
    d.shows.toArray(),
    d.movies.toArray(),
    d.ratings.toArray(),
    d.episodes.toArray(),
  ]);
  const lib = new Map(library.map((e) => [e.id, e]));
  const showMap = new Map(shows.map((s) => [s.id, s]));
  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const epMap = new Map(episodes.map((e) => [e.id, e]));
  const ratingMap = new Map(ratings.map((r) => [r.id, r.rating]));

  const rows: string[] = [CSV_HEADER.join(",")];
  for (const w of watches) {
    const parentId = w.kind === "episode" ? (w.showId ?? epMap.get(w.mediaId)?.showId ?? "") : w.mediaId;
    const media = w.kind === "episode" ? showMap.get(parentId) : movieMap.get(parentId);
    const entry = lib.get(parentId);
    const ids = { ...media?.ids, ...entry?.ids };
    let season: number | undefined;
    let episode: number | undefined;
    if (w.kind === "episode") {
      const ep = epMap.get(w.mediaId);
      const m = /:s(\d+)e(\d+)$/.exec(w.mediaId);
      season = ep?.season ?? (m ? Number(m[1]) : undefined);
      episode = ep?.number ?? (m ? Number(m[2]) : undefined);
    }
    const rating = w.kind === "episode" ? ratingMap.get(`episode:${w.mediaId}`) : ratingMap.get(`movie:${w.mediaId}`);
    rows.push(
      [
        w.kind,
        entry?.title ?? media?.title ?? parentId,
        media?.year,
        season,
        episode,
        w.watchedAt ? new Date(w.watchedAt).toISOString() : undefined,
        ids.imdb,
        ids.tvdb,
        ids.tmdb,
        ids.tvmaze,
        rating,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return rows.join("\r\n") + "\r\n";
}
