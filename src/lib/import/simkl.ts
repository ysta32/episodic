import Papa from "papaparse";
import type { ExternalIds, MediaKind, TrackStatus } from "../types";
import { emptyBundle, type ImportedItem, type ImportedWatch, type Importer } from "./types";

type Row = Record<string, unknown>;
const object = (value: unknown): Row | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : undefined;
const numeric = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
};
const integer = (value: unknown, minimum = 1): number | undefined => {
  const result = numeric(value);
  return result !== undefined && Number.isInteger(result) && result >= minimum ? result : undefined;
};
const date = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : undefined;
};
const ids = (value: unknown): ExternalIds => {
  const row = object(value) ?? {};
  const result: ExternalIds = {};
  for (const key of ["simkl", "tmdb", "tvdb", "trakt", "tvmaze"] as const) {
    const id = integer(row[key]);
    if (id !== undefined) result[key] = id;
  }
  if (typeof row.imdb === "string" && /^tt\d+$/.test(row.imdb.trim())) result.imdb = row.imdb.trim();
  return result;
};
const status = (value: unknown): TrackStatus | undefined => {
  if (typeof value !== "string") return undefined;
  switch (value.toLowerCase().replace(/[\s_-]/g, "")) {
    case "watching": return "watching";
    case "plantowatch": case "watchlist": return "watchlist";
    case "completed": return "completed";
    case "hold": case "onhold": case "paused": return "paused";
    case "dropped": return "dropped";
    default: return undefined;
  }
};
const sameMedia = (left: Pick<ImportedItem, "title" | "year" | "ids">, right: Pick<ImportedItem, "title" | "year" | "ids">): boolean => {
  const keys = ["imdb", "tmdb", "tvdb", "simkl"] as const;
  return keys.some((key) => left.ids[key] !== undefined && left.ids[key] === right.ids[key]) ||
    (left.title === right.title && left.year === right.year &&
      !keys.some((key) => left.ids[key] !== undefined && right.ids[key] !== undefined && left.ids[key] !== right.ids[key]));
};

export const importSimkl: Importer = async (files) => {
  const bundle = emptyBundle("simkl");
  const warn = (file: string, message: string) => bundle.warnings.push(`${file}: ${message}`);
  const addItem = (item: ImportedItem): void => {
    const matches = bundle.items.filter((candidate) => candidate.kind === item.kind && sameMedia(candidate, item));
    const existing = matches[0];
    if (!existing) { bundle.items.push(item); return; }
    for (const incoming of [...matches.slice(1), item]) {
      Object.assign(existing.ids, incoming.ids);
      if (incoming.rating !== undefined) existing.rating = incoming.rating;
      if (incoming.addedAt !== undefined) existing.addedAt = incoming.addedAt;
      if (incoming.status !== undefined && (existing.status === undefined || existing.status === "watchlist")) existing.status = incoming.status;
      if (existing.year === undefined) existing.year = incoming.year;
    }
    for (const duplicate of matches.slice(1)) bundle.items.splice(bundle.items.indexOf(duplicate), 1);
  };
  const entry = (value: unknown, group: string, file: string): void => {
    const row = object(value);
    if (!row) { warn(file, "skipped non-object entry"); return; }
    const media = object(row.show) ?? object(row.movie) ?? object(row.anime) ?? row;
    const type = typeof row.type === "string" ? row.type.toLowerCase() : group;
    const kind: MediaKind | undefined = row.movie || /^(movie|movies|film)$/.test(type) ? "movie" :
      row.show || row.anime || /^(show|shows|tv|tv show|series|anime)$/.test(type) ? "show" : undefined;
    if (!kind || typeof media.title !== "string" || !media.title.trim()) { warn(file, "skipped entry without a title or recognized type"); return; }
    const item = { kind, title: media.title.trim(), year: integer(media.year), ids: ids(media.ids),
      status: status(row.status), rating: undefined as number | undefined, addedAt: date(row.added_to_watchlist_at ?? row.added_at) };
    if (row.status && !item.status) warn(file, `unrecognized status for ${item.title}`);
    const score = numeric(row.user_rating ?? row.rating);
    if (score !== undefined && score > 0) item.rating = Math.min(10, Math.max(1, score));
    addItem(item);
    const watchedAt = date(row.last_watched_at ?? row.watched_at);
    if (kind === "movie" && (item.status === "completed" || watchedAt !== undefined)) bundle.watches.push({ kind: "movie", title: item.title, year: item.year, ids: item.ids, watchedAt });
    if (kind === "show" && Array.isArray(row.seasons)) for (const seasonValue of row.seasons) {
      const season = object(seasonValue);
      const seasonNumber = integer(season?.number, 0);
      if (!season || seasonNumber === undefined || !Array.isArray(season.episodes)) { warn(file, "skipped malformed season"); continue; }
      for (const episodeValue of season.episodes) {
        const episode = object(episodeValue);
        const episodeNumber = integer(episode?.number);
        if (!episode || episodeNumber === undefined) { warn(file, "skipped episode with invalid number"); continue; }
        bundle.watches.push({ kind: "episode", title: item.title, year: item.year, ids: item.ids,
          season: seasonNumber, number: episodeNumber, episodeIds: ids(episode.ids), watchedAt: date(episode.watched_at ?? episode.last_watched_at) });
      }
    }
  };
  const json = (value: unknown, file: string): void => {
    const row = object(value);
    if (row) {
      const groups = ["shows", "anime", "movies"].filter((key) => key in row);
      if (groups.length) {
        for (const group of groups) {
          if (!Array.isArray(row[group])) { warn(file, `skipped invalid ${group} collection`); continue; }
          for (const item of row[group]) entry(item, group, file);
        }
        return;
      }
    }
    const group = /movie/i.test(file) ? "movies" : /anime/i.test(file) ? "anime" : /show/i.test(file) ? "shows" : "";
    if (Array.isArray(value)) { for (const item of value) entry(item, group, file); }
    else if (row && (row.show || row.movie || row.anime || row.title)) entry(row, group, file);
    else warn(file, "skipped unsupported Simkl data");
  };
  for (const file of files) {
    let text: string;
    try { text = (await file.text()).replace(/^\uFEFF/, "").trim(); }
    catch { warn(file.name, "could not read file"); continue; }
    if (/^[\[{]/.test(text) || /\.json$/i.test(file.name)) {
      let value: unknown;
      try { value = JSON.parse(text); }
      catch { warn(file.name, "could not read JSON"); continue; }
      json(value, file.name);
      continue;
    }
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
    });
    const headers = parsed.meta.fields ?? [];
    if (!headers.includes("title") || !headers.includes("type") || !headers.some((key) => ["watchlist", "status", "watchliststatus"].includes(key))) {
      warn(file.name, "skipped unrecognized CSV headers"); continue;
    }
    const badRows = new Set<number>();
    for (const error of parsed.errors) {
      warn(file.name, `CSV ${error.code}${error.row === undefined ? "" : ` at row ${error.row + 2}`}`);
      if (error.row !== undefined) badRows.add(error.row);
    }
    parsed.data.forEach((row, index) => {
      if (badRows.has(index)) return;
      const candidates = [row.status, row.watchlist, row.watchliststatus];
      const recognizedStatus = candidates.find((value) => status(value) !== undefined);
      entry({ title: row.title, type: row.type, year: row.year, status: recognizedStatus ?? candidates.find((value) => value?.trim()),
        user_rating: row.userrating || row.rating, last_watched_at: row.lastwatchedat || row.watchedat,
        ids: { imdb: row.imdbid || row.imdb, tmdb: row.tmdb || row.tmdbid, tvdb: row.tvdb || row.tvdbid, simkl: row.simkl || row.simklid } }, "", file.name);
    });
  }
  const watches: ImportedWatch[] = [];
  for (const watch of bundle.watches) {
    const item = bundle.items.find((candidate) => candidate.kind === (watch.kind === "movie" ? "movie" : "show") && sameMedia(candidate, watch));
    if (item) {
      watch.ids = item.ids;
      watch.title = item.title;
      watch.year = item.year;
    }
    const previous = watches.find((candidate) => candidate.kind === watch.kind && sameMedia(candidate, watch) &&
      candidate.season === watch.season && candidate.number === watch.number);
    if (!previous) watches.push(watch);
    else {
      previous.ids = { ...previous.ids, ...watch.ids };
      if (watch.episodeIds) previous.episodeIds = { ...previous.episodeIds, ...watch.episodeIds };
      if (watch.watchedAt !== undefined && (previous.watchedAt === undefined || watch.watchedAt > previous.watchedAt)) previous.watchedAt = watch.watchedAt;
    }
  }
  bundle.watches = watches;
  return bundle;
};
