// FROZEN CONTRACT — domain model shared by every module. Change only via a DECISION.
export type MediaKind = "show" | "movie";

/** Cross-service ids used to resolve imported items to TVmaze/TMDB. */
export interface ExternalIds {
  tvmaze?: number;
  tmdb?: number;
  imdb?: string; // "tt1234567"
  tvdb?: number;
  trakt?: number;
  simkl?: number;
}

export interface Show {
  id: string; // ALWAYS "tvmaze:<n>" (D-08). Movies use "tmdb:<n>" or "imdb:tt..", so ids never collide.
  kind: "show";
  title: string;
  year?: number;
  ids: ExternalIds;
  poster?: string;
  backdrop?: string;
  summary?: string;
  status?: "running" | "ended" | "tbd" | "unknown";
  network?: string;
  genres?: string[];
  runtime?: number; // minutes
  fetchedAt: number; // epoch ms, for cache TTL
}

export interface Episode {
  id: string; // "<showId>:s<season>e<number>"
  showId: string;
  season: number;
  number: number;
  title?: string;
  airdate?: string; // ISO date "2026-10-07"
  airstamp?: string; // ISO datetime
  runtime?: number;
  summary?: string;
  image?: string;
  tvmazeId?: number;
}

export interface Movie {
  id: string; // "tmdb:<n>" or "imdb:tt..." when unresolved
  kind: "movie";
  title: string;
  year?: number;
  ids: ExternalIds;
  poster?: string;
  summary?: string;
  runtime?: number;
  releaseDate?: string;
  fetchedAt: number;
}

/** A user's relation to a show or movie (library entry). */
export type TrackStatus = "watching" | "watchlist" | "completed" | "paused" | "dropped";
export interface LibraryEntry {
  id: string; // = Show.id or Movie.id
  kind: MediaKind;
  status: TrackStatus;
  addedAt: number;
  updatedAt: number;
  rating?: number; // 1..10
  favorite?: boolean;
  title: string; // denormalized so list views work offline before metadata fetch
  ids: ExternalIds;
}

/** One watch event. Episodes: mediaId = Episode.id. Movies: mediaId = Movie.id. */
export interface WatchEvent {
  id: string; // uuid
  kind: "episode" | "movie";
  mediaId: string;
  showId?: string; // for episodes
  watchedAt: number; // epoch ms; 0 if unknown date
  source: ImportSource | "manual" | "scrobble";
}

export interface Rating {
  id: string; // `${kind}:${mediaId}`
  kind: "show" | "movie" | "episode";
  mediaId: string;
  rating: number; // 1..10
  ratedAt: number;
}

export interface UserList {
  id: string;
  name: string;
  description?: string;
  items: { kind: MediaKind; id: string; title: string; addedAt: number }[];
  createdAt: number;
  updatedAt: number;
}

export type ImportSource = "tvtime" | "trakt" | "simkl" | "letterboxd" | "imdb" | "csv" | "episodic";

export interface Settings {
  id: "settings";
  displayName?: string;
  spoilerMode: "blur" | "hide" | "show";
  supporter: boolean;
  syncEnabled: boolean;
  theme: "system" | "dark" | "light";
}
