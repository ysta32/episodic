// FROZEN CONTRACT — metadata provider. TVmaze always; TMDB only if TMDB_API_KEY (server) is set.
import type { Episode, ExternalIds, Movie, Show } from "../types";
export interface SearchResult { kind: "show" | "movie"; id: string; title: string; year?: number; poster?: string; ids: ExternalIds; }
export interface MetadataProvider {
  search(query: string): Promise<SearchResult[]>;
  getShow(id: string): Promise<Show | null>;
  getEpisodes(showId: string): Promise<Episode[]>;
  getMovie(id: string): Promise<Movie | null>;
  /** Resolve imported ids/title to a canonical id ("tvmaze:1" / "tmdb:2"). */
  resolve(kind: "show" | "movie", ids: ExternalIds, title: string, year?: number): Promise<string | null>;
  /** Episodes airing in [from,to] for given shows (calendar). */
  schedule(showIds: string[], fromISO: string, toISO: string): Promise<Episode[]>;
}
