// FROZEN CONTRACT — every importer is a pure function: files in, ImportBundle out. No DB, no network.
import type { ExternalIds, ImportSource, MediaKind, TrackStatus } from "../types";

export interface ImportedItem {
  kind: MediaKind;
  title: string;
  year?: number;
  ids: ExternalIds;
  status?: TrackStatus;
  rating?: number; // normalized to 1..10
  addedAt?: number;
}
export interface ImportedWatch {
  kind: "episode" | "movie";
  title: string; // show title or movie title
  year?: number;
  ids: ExternalIds; // ids of the show/movie
  season?: number;
  number?: number;
  episodeIds?: ExternalIds; // e.g. tvdb episode id from TV Time
  watchedAt?: number; // epoch ms
}
export interface ImportedEpisodeRating {
  showIds: ExternalIds; showTitle: string; season: number; number: number; rating: number;
}
export interface ImportBundle {
  source: ImportSource;
  items: ImportedItem[];
  watches: ImportedWatch[];
  episodeRatings: ImportedEpisodeRating[];
  lists: { name: string; items: { kind: MediaKind; title: string; year?: number; ids: ExternalIds }[] }[];
  warnings: string[]; // human-readable, e.g. "skipped 3 rows without a title"
}
/** Input file abstraction (works for File in browser and Buffer in tests). */
export interface InputFile { name: string; text(): Promise<string>; bytes(): Promise<Uint8Array>; }
export type Importer = (files: InputFile[]) => Promise<ImportBundle>;
export const emptyBundle = (source: ImportSource): ImportBundle => ({ source, items: [], watches: [], episodeRatings: [], lists: [], warnings: [] });
