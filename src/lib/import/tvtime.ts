// TV Time GDPR export importer: pure function, files (zip or CSVs) -> ImportBundle.
import Papa from "papaparse";
import type { ExternalIds } from "../types";
import { emptyBundle } from "./types";
import type { ImportBundle, ImportedEpisodeRating, ImportedItem, ImportedWatch, Importer, InputFile } from "./types";
import { expandZips } from "./zip";

type Row = Record<string, string>;

const COLS = {
  showTitle: ["tv_show_name", "series_name", "show_name", "tv_show_title", "series_title"],
  movieTitle: ["movie_name", "movie_title"],
  season: ["episode_season_number", "season_number", "season"],
  number: ["episode_number", "number", "episode_num"],
  showTvdb: ["tv_show_id", "series_tvdb_id", "show_tvdb_id", "tvdb_series_id", "series_id", "s_id", "show_id"],
  episodeTvdb: ["episode_tvdb_id", "episode_id", "ep_id", "tvdb_episode_id"],
  movieTvdb: ["movie_tvdb_id", "movie_id", "tvdb_movie_id"],
  genericTvdb: ["tvdb_id"],
  imdb: ["imdb_id", "movie_imdb_id", "series_imdb_id", "imdb"],
  watchedAt: ["watched_at", "seen_at", "created_at", "updated_at"],
  addedAt: ["created_at", "followed_at", "added_at", "updated_at"],
  entity: ["entity_type", "media_type", "kind"],
  type: ["type", "list_type", "status", "watch_type", "action"],
  release: ["release_date", "movie_release_date", "year"],
  rating: ["rating", "vote", "score", "note", "stars", "user_rating"],
  archived: ["is_archived", "archived"],
  favorite: ["is_favorited", "is_favorite", "favorited", "favorite"],
} as const;

function get(row: Row, cols: readonly string[]): string | undefined {
  for (const c of cols) {
    const v = row[c];
    if (v !== undefined) {
      const t = v.trim();
      if (t !== "" && t.toLowerCase() !== "null" && t !== "\\N") return t;
    }
  }
  return undefined;
}

function hasAny(headers: Set<string>, cols: readonly string[]): boolean {
  return cols.some((c) => headers.has(c));
}

function toInt(v: string | undefined): number | undefined {
  if (v === undefined || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : undefined;
}

function toPositiveId(v: string | undefined): number | undefined {
  const n = toInt(v);
  return n !== undefined && n > 0 ? n : undefined;
}

function toImdb(v: string | undefined): string | undefined {
  const m = v?.match(/tt\d{5,}/);
  return m ? m[0] : undefined;
}

function truthy(v: string | undefined): boolean {
  return v !== undefined && ["1", "true", "t", "yes", "y"].includes(v.toLowerCase());
}

/** Parse TV Time date strings ("2019-05-12 18:23:45", ISO, epoch s/ms) to epoch ms. undefined = absent, NaN = unparseable. */
export function parseDate(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (/^\d{9,13}$/.test(v)) {
    const n = Number(v);
    return v.length <= 10 ? n * 1000 : n;
  }
  let s = v;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(.*)$/);
  if (m) {
    const tz = m[3].trim();
    s = `${m[1]}T${m[2]}${tz === "" ? "Z" : tz.replace(/^UTC$/i, "Z")}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    s = `${s}T00:00:00Z`;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

function yearOf(v: string | undefined): number | undefined {
  const m = v?.match(/^(\d{4})/);
  if (!m) return undefined;
  const y = Number(m[1]);
  return y >= 1870 && y <= 2200 ? y : undefined;
}

/** Normalize a raw rating to 1..10 given the file's observed max (<=5 means a 5-star scale, >10 means 0..100). */
function normalizeRating(raw: number, scaleMax: number): number | undefined {
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  let r = raw;
  if (scaleMax <= 5) r = raw * 2;
  else if (scaleMax > 10) r = raw / 10;
  return Math.min(10, Math.max(1, Math.round(r)));
}

function ratingScale(rows: Row[]): number {
  let max = 0;
  for (const r of rows) {
    const n = Number(get(r, COLS.rating));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

function basename(name: string): string {
  const parts = name.split(/[\\/]/);
  return (parts[parts.length - 1] ?? name).toLowerCase();
}

function parseCsv(text: string): { rows: Row[]; headers: Set<string>; errors: number } {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const res = Papa.parse<Row>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^﻿/, "").trim().toLowerCase(),
  });
  const headers = new Set(res.meta.fields ?? []);
  // Papa reports per-row field-count mismatches; such rows are still usable by header name.
  const fatal = res.errors.filter((e) => e.type !== "FieldMismatch");
  return { rows: res.data, headers, errors: fatal.length };
}

class Warn {
  private counts = new Map<string, number>();
  add(file: string, reason: string, n = 1): void {
    const k = `${file}: ${reason}`;
    this.counts.set(k, (this.counts.get(k) ?? 0) + n);
  }
  list(): string[] {
    return [...this.counts].map(([k, n]) => {
      const i = k.indexOf(": ");
      return `${k.slice(0, i)}: skipped ${n} row${n === 1 ? "" : "s"} ${k.slice(i + 2)}`;
    });
  }
}

type Kind = "tracking" | "episodes" | "shows" | "ratings" | "movies" | null;

function classify(base: string, headers: Set<string>): Kind {
  if (!base.endsWith(".csv")) return null;
  const hasSE = hasAny(headers, COLS.season) && hasAny(headers, COLS.number);
  const hasRating = hasAny(headers, COLS.rating);
  if (/(vote|rating)/.test(base) && hasSE && hasRating) return "ratings";
  if (/emotion/.test(base)) return hasSE && hasRating ? "ratings" : null;
  if (base.startsWith("tracking-prod-records") || hasAny(headers, COLS.entity)) return "tracking";
  if (hasSE && hasAny(headers, [...COLS.showTitle, ...COLS.showTvdb])) return "episodes";
  if (hasAny(headers, COLS.movieTitle)) return "movies";
  if (/(followed_tv_show|user_tv_show_data|tv_show)/.test(base) && hasAny(headers, [...COLS.showTitle, ...COLS.showTvdb])) return "shows";
  return null;
}

const WATCHED_TYPES = new Set(["watch", "watched", "seen", "rewatch", "checkin", "check_in", "history"]);

/** File names that hold a movie watchlist (rows default to watchlist when they lack a type/status). */
export function isWatchlistFile(base: string): boolean {
  return /(watch_?list|to_?watch|to-watch|want_?to_?watch|planned)/.test(base);
}

function isWatchlistType(t: string | undefined): boolean {
  if (!t) return false;
  const s = t.toLowerCase().replace(/[\s_-]/g, "");
  return s.includes("towatch") || s.includes("watchlist") || s.includes("wanttowatch") || s === "follow" || s === "planned";
}

interface Ctx {
  warn: Warn;
  watches: ImportedWatch[];
  items: ImportedItem[];
  ratings: ImportedEpisodeRating[];
}

function episodeWatch(ctx: Ctx, file: string, r: Row, idKeys: { show: readonly string[] }): void {
  const title = get(r, COLS.showTitle);
  const showTvdb = toPositiveId(get(r, idKeys.show));
  const season = toInt(get(r, COLS.season));
  const number = toInt(get(r, COLS.number));
  if (!title && showTvdb === undefined) return ctx.warn.add(file, "without a show title or id");
  if (season === undefined || number === undefined) return ctx.warn.add(file, "without a valid season/episode number");
  const watchedAt = parseDate(get(r, COLS.watchedAt));
  if (watchedAt !== undefined && Number.isNaN(watchedAt)) ctx.warn.add(file, "with an unparseable date (kept without date)");
  const ids: ExternalIds = {};
  if (showTvdb !== undefined) ids.tvdb = showTvdb;
  const imdb = toImdb(get(r, ["series_imdb_id", "imdb_id"]));
  if (imdb) ids.imdb = imdb;
  const epTvdb = toPositiveId(get(r, COLS.episodeTvdb));
  const w: ImportedWatch = { kind: "episode", title: title ?? `tvdb:${showTvdb}`, ids, season, number };
  if (epTvdb !== undefined) w.episodeIds = { tvdb: epTvdb };
  if (watchedAt !== undefined && !Number.isNaN(watchedAt)) w.watchedAt = watchedAt;
  ctx.watches.push(w);
}

function movieRow(ctx: Ctx, file: string, r: Row, scale: number, defaultWatchlist: boolean): void {
  const title = get(r, COLS.movieTitle) ?? get(r, ["title", "name"]);
  if (!title) return ctx.warn.add(file, "without a movie title");
  const ids: ExternalIds = {};
  const imdb = toImdb(get(r, COLS.imdb));
  if (imdb) ids.imdb = imdb;
  const tvdb = toPositiveId(get(r, [...COLS.movieTvdb, ...COLS.genericTvdb]));
  if (tvdb !== undefined) ids.tvdb = tvdb;
  const year = yearOf(get(r, COLS.release));
  const date = parseDate(get(r, COLS.watchedAt));
  if (date !== undefined && Number.isNaN(date)) ctx.warn.add(file, "with an unparseable date (kept without date)");
  const when = date !== undefined && !Number.isNaN(date) ? date : undefined;
  const rawRating = Number(get(r, COLS.rating));
  const rating = normalizeRating(rawRating, scale);
  const type = get(r, COLS.type);
  const watchlist = type === undefined || !(isWatchlistType(type) || WATCHED_TYPES.has(type.toLowerCase())) ? defaultWatchlist : isWatchlistType(type);
  if (watchlist) {
    const it: ImportedItem = { kind: "movie", title, ids, status: "watchlist" };
    if (year !== undefined) it.year = year;
    if (when !== undefined) it.addedAt = when;
    ctx.items.push(it);
    return;
  }
  const w: ImportedWatch = { kind: "movie", title, ids };
  if (year !== undefined) w.year = year;
  if (when !== undefined) w.watchedAt = when;
  ctx.watches.push(w);
  if (rating !== undefined) {
    const it: ImportedItem = { kind: "movie", title, ids: { ...ids }, status: "completed", rating };
    if (year !== undefined) it.year = year;
    ctx.items.push(it);
  }
}

function showRow(ctx: Ctx, file: string, r: Row, scale: number): void {
  const title = get(r, COLS.showTitle);
  const tvdb = toPositiveId(get(r, [...COLS.showTvdb, ...COLS.genericTvdb]));
  if (!title && tvdb === undefined) return ctx.warn.add(file, "without a show title or id");
  const ids: ExternalIds = {};
  if (tvdb !== undefined) ids.tvdb = tvdb;
  const imdb = toImdb(get(r, COLS.imdb));
  if (imdb) ids.imdb = imdb;
  const it: ImportedItem = {
    kind: "show",
    title: title ?? `tvdb:${tvdb}`,
    ids,
    status: truthy(get(r, COLS.archived)) ? "dropped" : "watching",
  };
  const added = parseDate(get(r, COLS.addedAt));
  if (added !== undefined && !Number.isNaN(added)) it.addedAt = added;
  const rating = normalizeRating(Number(get(r, COLS.rating)), scale);
  if (rating !== undefined) it.rating = rating;
  if (truthy(get(r, COLS.favorite))) it.favorite = true;
  ctx.items.push(it);
}

function ratingRow(ctx: Ctx, file: string, r: Row, scale: number): void {
  const title = get(r, COLS.showTitle);
  const tvdb = toPositiveId(get(r, COLS.showTvdb));
  const season = toInt(get(r, COLS.season));
  const number = toInt(get(r, COLS.number));
  const raw = get(r, COLS.rating);
  if (!title && tvdb === undefined) return ctx.warn.add(file, "without a show title or id");
  if (season === undefined || number === undefined) return ctx.warn.add(file, "without a valid season/episode number");
  const rating = raw === undefined ? undefined : normalizeRating(Number(raw), scale);
  if (rating === undefined) return ctx.warn.add(file, "without a numeric rating");
  const showIds: ExternalIds = {};
  if (tvdb !== undefined) showIds.tvdb = tvdb;
  ctx.ratings.push({ showIds, showTitle: title ?? `tvdb:${tvdb}`, season, number, rating });
}

function trackingRow(ctx: Ctx, file: string, r: Row, scale: number, defaultWatchlist: boolean): void {
  const entity = (get(r, COLS.entity) ?? "").toLowerCase();
  if (entity === "movie" || (entity === "" && get(r, COLS.movieTitle) && !get(r, COLS.showTitle))) {
    return movieRow(ctx, file, r, scale, defaultWatchlist);
  }
  if (entity === "episode" || (entity === "" && get(r, COLS.season) !== undefined)) {
    return episodeWatch(ctx, file, r, { show: COLS.showTvdb });
  }
  if (["series", "show", "tv_show", "tvshow"].includes(entity)) return showRow(ctx, file, r, scale);
  ctx.warn.add(file, `with unknown entity type${entity ? ` "${entity}"` : ""}`);
}

const titleKey = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

type Entity = "show" | "movie";
type KeyFn = (entity: Entity, title: string, ids: ExternalIds) => string;

const isPlaceholderTitle = (t: string) => /^tvdb:\d+$/.test(t);

function idNodes(entity: Entity, ids: ExternalIds): string[] {
  const out: string[] = [];
  if (ids.tvdb !== undefined) out.push(`${entity}|tvdb:${ids.tvdb}`);
  if (ids.imdb !== undefined) out.push(`${entity}|imdb:${ids.imdb}`);
  return out;
}

/**
 * Cross-file entity resolution. Ids win: records sharing any id (tvdb/imdb, linked transitively when one
 * record carries both) are one entity, even if their titles differ. Records with ids never merge on title
 * alone, so same-titled shows with different ids stay distinct. A title-only record joins the id entity
 * seen with that normalized title only when exactly one exists; otherwise it keys by title.
 */
class Resolver {
  private parent = new Map<string, string>();
  private titleRoots = new Map<string, Set<string>>();
  private rootTitle = new Map<string, string>();
  private pending: { entity: Entity; title: string; ids: ExternalIds }[] = [];

  private find(x: string): string {
    let r = x;
    while (this.parent.has(r) && this.parent.get(r) !== r) r = this.parent.get(r) as string;
    if (!this.parent.has(r)) this.parent.set(r, r);
    let c = x;
    while (c !== r) {
      const next = this.parent.get(c) as string;
      this.parent.set(c, r);
      c = next;
    }
    return r;
  }

  add(entity: Entity, title: string, ids: ExternalIds): void {
    const nodes = idNodes(entity, ids);
    if (nodes.length === 0) return;
    const r0 = this.find(nodes[0]);
    for (const n of nodes.slice(1)) {
      const rn = this.find(n);
      if (rn !== r0) this.parent.set(rn, r0);
    }
    this.pending.push({ entity, title, ids });
  }

  /** Finalize after all add() calls; returns the key function. */
  build(): { key: KeyFn; title: (entity: Entity, title: string, ids: ExternalIds) => string } {
    for (const p of this.pending) {
      const root = this.find(idNodes(p.entity, p.ids)[0]);
      if (isPlaceholderTitle(p.title)) continue;
      const tk = `${p.entity}|${titleKey(p.title)}`;
      const set = this.titleRoots.get(tk) ?? new Set<string>();
      set.add(root);
      this.titleRoots.set(tk, set);
      if (!this.rootTitle.has(root)) this.rootTitle.set(root, p.title);
    }
    const key: KeyFn = (entity, title, ids) => {
      const nodes = idNodes(entity, ids);
      if (nodes.length > 0) return `id:${this.find(nodes[0])}`;
      const roots = this.titleRoots.get(`${entity}|${titleKey(title)}`);
      if (roots && roots.size === 1) return `id:${[...roots][0]}`;
      return `${entity}|t:${titleKey(title)}`;
    };
    const title = (entity: Entity, t: string, ids: ExternalIds) => {
      if (!isPlaceholderTitle(t)) return t;
      const nodes = idNodes(entity, ids);
      return (nodes.length > 0 && this.rootTitle.get(this.find(nodes[0]))) || t;
    };
    return { key, title };
  }
}

const entityOf = (k: "episode" | "movie" | "show"): Entity => (k === "movie" ? "movie" : "show");

function earlier(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined) return false;
  if (b === undefined) return true;
  return a < b;
}

function dedupeWatches(watches: ImportedWatch[], idKey: KeyFn): ImportedWatch[] {
  const out = new Map<string, ImportedWatch>();
  for (const w of watches) {
    const base = idKey(entityOf(w.kind), w.title, w.ids);
    const key = w.kind === "episode" ? `${base}|s${w.season}e${w.number}` : `${base}|${w.watchedAt ?? "?"}`;
    const prev = out.get(key);
    if (!prev) {
      out.set(key, { ...w, ids: { ...w.ids } });
      continue;
    }
    const keep = earlier(w.watchedAt, prev.watchedAt) ? { ...w, ids: { ...w.ids } } : prev;
    const other = keep === prev ? w : prev;
    keep.ids = { ...other.ids, ...keep.ids };
    if (other.episodeIds || keep.episodeIds) keep.episodeIds = { ...other.episodeIds, ...keep.episodeIds };
    if (keep.year === undefined && other.year !== undefined) keep.year = other.year;
    if (isPlaceholderTitle(keep.title) && !isPlaceholderTitle(other.title)) keep.title = other.title;
    out.set(key, keep);
  }
  return [...out.values()];
}

const STATUS_RANK: Record<string, number> = { watchlist: 0, watching: 1, completed: 2, paused: 3, dropped: 4 };

function dedupeItems(items: ImportedItem[], idKey: KeyFn): ImportedItem[] {
  const out = new Map<string, ImportedItem>();
  for (const it of items) {
    const key = idKey(it.kind, it.title, it.ids);
    const prev = out.get(key);
    if (!prev) {
      out.set(key, { ...it, ids: { ...it.ids } });
      continue;
    }
    prev.ids = { ...it.ids, ...prev.ids };
    if (it.status && (!prev.status || STATUS_RANK[it.status] > STATUS_RANK[prev.status])) prev.status = it.status;
    if (prev.rating === undefined && it.rating !== undefined) prev.rating = it.rating;
    if (it.favorite) prev.favorite = true;
    if (isPlaceholderTitle(prev.title) && !isPlaceholderTitle(it.title)) prev.title = it.title;
    if (prev.year === undefined && it.year !== undefined) prev.year = it.year;
    if (earlier(it.addedAt, prev.addedAt)) prev.addedAt = it.addedAt;
  }
  return [...out.values()];
}

function dedupeRatings(ratings: ImportedEpisodeRating[], idKey: KeyFn): ImportedEpisodeRating[] {
  // Later rows win (a re-vote supersedes an earlier one).
  const out = new Map<string, ImportedEpisodeRating>();
  for (const r of ratings) {
    const key = `${idKey("show", r.showTitle, r.showIds)}|s${r.season}e${r.number}`;
    const prev = out.get(key);
    const showTitle = isPlaceholderTitle(r.showTitle) && prev && !isPlaceholderTitle(prev.showTitle) ? prev.showTitle : r.showTitle;
    out.set(key, prev ? { ...r, showTitle, showIds: { ...prev.showIds, ...r.showIds } } : r);
  }
  return [...out.values()];
}

async function readText(f: InputFile): Promise<string> {
  return f.text();
}

export const importTvTime: Importer = async (files) => {
  const bundle: ImportBundle = emptyBundle("tvtime");
  const ctx: Ctx = { warn: new Warn(), watches: [], items: [], ratings: [] };
  const expanded = await expandZips(files);
  let recognized = 0;
  for (const f of expanded) {
    const base = basename(f.name);
    if (!base.endsWith(".csv")) continue;
    const { rows, headers, errors } = parseCsv(await readText(f));
    const kind = classify(base, headers);
    if (!kind) continue;
    recognized++;
    if (errors > 0) bundle.warnings.push(`${base}: ${errors} CSV parse error${errors === 1 ? "" : "s"}`);
    const scale = ratingScale(rows);
    const defaultWatchlist = isWatchlistFile(base);
    for (const r of rows) {
      switch (kind) {
        case "tracking":
          trackingRow(ctx, base, r, scale, defaultWatchlist);
          break;
        case "episodes":
          episodeWatch(ctx, base, r, { show: COLS.showTvdb });
          break;
        case "shows":
          showRow(ctx, base, r, scale);
          break;
        case "movies":
          movieRow(ctx, base, r, scale, defaultWatchlist);
          break;
        case "ratings":
          ratingRow(ctx, base, r, scale);
          break;
      }
    }
  }
  if (recognized === 0) bundle.warnings.push("No TV Time export files were recognized (expected e.g. seen_episode.csv or tracking-prod-records.csv).");
  const resolver = new Resolver();
  for (const w of ctx.watches) resolver.add(entityOf(w.kind), w.title, w.ids);
  for (const it of ctx.items) resolver.add(it.kind, it.title, it.ids);
  for (const r of ctx.ratings) resolver.add("show", r.showTitle, r.showIds);
  const { key, title } = resolver.build();
  bundle.watches = dedupeWatches(ctx.watches, key).map((w) => ({ ...w, title: title(entityOf(w.kind), w.title, w.ids) }));
  bundle.items = dedupeItems(ctx.items, key).map((it) => ({ ...it, title: title(it.kind, it.title, it.ids) }));
  bundle.episodeRatings = dedupeRatings(ctx.ratings, key).map((r) => ({ ...r, showTitle: title("show", r.showTitle, r.showIds) }));
  bundle.warnings.push(...ctx.warn.list());
  return bundle;
};
