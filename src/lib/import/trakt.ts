import type { ExternalIds, MediaKind, TrackStatus } from "../types";
import { emptyBundle, type ImportedItem, type Importer } from "./types";

type Row = Record<string, unknown>;
const object = (value: unknown): Row | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : undefined;
const number = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
};
const integer = (value: unknown, minimum = 1): number | undefined => {
  const result = number(value);
  return result !== undefined && Number.isInteger(result) && result >= minimum ? result : undefined;
};
const date = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : undefined;
};
const rating = (value: unknown): number | undefined => {
  const result = number(value);
  return result !== undefined && result > 0 ? Math.min(10, Math.max(1, result)) : undefined;
};
const ids = (value: unknown): ExternalIds => {
  const row = object(value) ?? {};
  const result: ExternalIds = {};
  for (const key of ["trakt", "tvdb", "tmdb", "simkl", "tvmaze"] as const) {
    const id = integer(row[key]);
    if (id !== undefined) result[key] = id;
  }
  if (typeof row.imdb === "string" && /^tt\d+$/.test(row.imdb)) result.imdb = row.imdb;
  return result;
};

export const importTrakt: Importer = async (files) => {
  const bundle = emptyBundle("trakt");
  const warn = (file: string, message: string) => bundle.warnings.push(`${file}: ${message}`);
  const addItem = (item: ImportedItem) => {
    const existing = bundle.items.find((candidate) => candidate.kind === item.kind && (
      Object.entries(item.ids).some(([key, value]) => candidate.ids[key as keyof ExternalIds] === value) ||
      (candidate.title === item.title && candidate.year === item.year &&
        !Object.keys(item.ids).some((key) => {
          const id = key as keyof ExternalIds;
          return candidate.ids[id] !== undefined && candidate.ids[id] !== item.ids[id];
        }))
    ));
    if (!existing) bundle.items.push(item);
    else {
      existing.ids = { ...existing.ids, ...item.ids };
      if (item.rating !== undefined) existing.rating = item.rating;
      if (item.addedAt !== undefined) existing.addedAt = item.addedAt;
      if (item.status !== undefined && (existing.status === undefined || existing.status === "watchlist")) existing.status = item.status;
    }
  };
  const addWatch = (watch: (typeof bundle.watches)[number]) => {
    if (!bundle.watches.some((previous) => previous.kind === watch.kind &&
      previous.title === watch.title && previous.year === watch.year &&
      JSON.stringify(previous.ids) === JSON.stringify(watch.ids) &&
      previous.season === watch.season && previous.number === watch.number &&
      previous.watchedAt === watch.watchedAt)) bundle.watches.push(watch);
  };
  const entry = (value: unknown, mode: string, file: string, listContext = false): ImportedItem | undefined => {
    const row = object(value);
    if (!row) { warn(file, "skipped non-object entry"); return; }
    const kind: MediaKind | undefined = object(row.movie) ? "movie" : object(row.show) ? "show" :
      /movies?/.test(mode) ? "movie" : /shows?/.test(mode) ? "show" : undefined;
    const media = object(row.movie) ?? object(row.show) ?? row;
    if (!kind || typeof media.title !== "string" || !media.title.trim()) {
      warn(file, "skipped entry without a title or media type"); return;
    }
    const item: ImportedItem = { kind, title: media.title.trim(), year: integer(media.year), ids: ids(media.ids) };
    if (listContext) return item;
    const watched = /watched|history/.test(mode) || row.watched_at !== undefined || row.last_watched_at !== undefined || Array.isArray(row.seasons);
    const status: TrackStatus | undefined = watched ? (kind === "movie" ? "completed" : "watching") : /watchlist/.test(mode) || row.listed_at !== undefined ? "watchlist" : undefined;
    if (status) item.status = status;
    const score = rating(row.rating);
    if (score !== undefined && !object(row.episode)) item.rating = score;
    const addedAt = date(row.listed_at ?? row.collected_at);
    if (addedAt !== undefined) item.addedAt = addedAt;
    addItem(item);
    const episode = (episodeValue: unknown, seasonValue: unknown, isWatch: boolean) => {
      const ep = object(episodeValue);
      const season = integer(ep?.season ?? seasonValue, 0);
      const epNumber = integer(ep?.number);
      if (!ep || season === undefined || epNumber === undefined) { warn(file, "skipped episode with invalid season or number"); return; }
      if (isWatch) addWatch({ kind: "episode", title: item.title, year: item.year, ids: item.ids,
        season, number: epNumber, episodeIds: ids(ep.ids), watchedAt: date(ep.watched_at ?? ep.last_watched_at ?? row.watched_at ?? row.last_watched_at) });
      const epRating = rating(ep.rating ?? (row.episode === episodeValue ? row.rating : undefined));
      if (epRating !== undefined) bundle.episodeRatings.push({ showIds: item.ids, showTitle: item.title, season, number: epNumber, rating: epRating });
    };
    if (kind === "movie" && watched) addWatch({ kind: "movie", title: item.title, year: item.year, ids: item.ids, watchedAt: date(row.watched_at ?? row.last_watched_at) });
    if (kind === "show") {
      if (row.episode !== undefined) episode(row.episode, undefined, watched);
      if (Array.isArray(row.seasons)) for (const seasonValue of row.seasons) {
        const season = object(seasonValue);
        if (!season || !Array.isArray(season.episodes)) { warn(file, "skipped malformed season"); continue; }
        for (const ep of season.episodes) episode(ep, season.number, watched);
      }
    }
    return item;
  };
  const parse = (value: unknown, mode: string, file: string): void => {
    const row = object(value);
    if (row && Array.isArray(row.items)) {
      const listMeta = object(row.list);
      const name = typeof row.name === "string" ? row.name : typeof listMeta?.name === "string" ? listMeta.name : file.replace(/\.[^.]+$/, "");
      const items = row.items.map((item) => entry(item, "list", file, true)).filter((item): item is ImportedItem => item !== undefined);
      bundle.lists.push({ name, items: items.map(({ kind, title, year, ids }) => ({ kind, title, year, ids })) });
      return;
    }
    if (Array.isArray(value)) {
      if (/lists?/.test(mode) && !/watchlist/.test(mode) && !value.some((item) => Array.isArray(object(item)?.items))) {
        parse({ name: file.replace(/\.[^.]+$/, ""), items: value }, mode, file);
      } else for (const item of value) {
        if (Array.isArray(object(item)?.items)) parse(item, mode, file);
        else entry(item, mode, file);
      }
      return;
    }
    if (row) {
      const groups = Object.entries(row).filter(([key, content]) => /^(watched|watchlist|ratings|history|lists|shows|movies)([-_].*)?$/.test(key) && (Array.isArray(content) || object(content)));
      if (groups.length) { for (const [key, content] of groups) parse(content, `${mode}-${key}`, file); return; }
      if (row.movie || row.show || row.title) { entry(row, mode, file); return; }
    }
    warn(file, "skipped unsupported Trakt data");
  };
  for (const file of files) {
    let value: unknown;
    try { value = JSON.parse((await file.text()).replace(/^\uFEFF/, "")); }
    catch { warn(file.name, "could not read JSON"); continue; }
    parse(value, file.name.toLowerCase(), file.name);
  }
  return bundle;
};
