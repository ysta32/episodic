// FROZEN CONTRACT — local-first store (IndexedDB via Dexie). All user data lives here; sync is optional.
import Dexie, { type Table } from "dexie";
import type { Episode, LibraryEntry, Movie, Rating, Settings, Show, UserList, WatchEvent } from "./types";

export interface CacheRow { key: string; value: unknown; expiresAt: number; }

export class EpisodicDB extends Dexie {
  library!: Table<LibraryEntry, string>;
  watches!: Table<WatchEvent, string>;
  ratings!: Table<Rating, string>;
  lists!: Table<UserList, string>;
  shows!: Table<Show, string>;
  episodes!: Table<Episode, string>;
  movies!: Table<Movie, string>;
  settings!: Table<Settings, string>;
  cache!: Table<CacheRow, string>;
  constructor(name = "episodic") {
    super(name);
    this.version(1).stores({
      library: "id, kind, status, updatedAt",
      watches: "id, kind, mediaId, showId, watchedAt, [showId+mediaId]",
      ratings: "id, kind, mediaId",
      lists: "id, updatedAt",
      shows: "id, fetchedAt",
      episodes: "id, showId, airdate, [showId+season]",
      movies: "id, fetchedAt",
      settings: "id",
      cache: "key, expiresAt",
    });
  }
}
let _db: EpisodicDB | null = null;
export const db = (): EpisodicDB => (_db ??= new EpisodicDB());
/** Tests only: swap in a fresh, isolated DB. */
export const __setDb = (d: EpisodicDB) => { _db = d; };
export const DEFAULT_SETTINGS: Settings = { id: "settings", spoilerMode: "blur", supporter: false, syncEnabled: false, theme: "system" };
