import Papa from "papaparse";
import type { ExternalIds, MediaKind, TrackStatus } from "../types";
import { emptyBundle, type ImportBundle, type ImportedItem, type Importer } from "./types";

export type Row = Record<string, string>;

/** Parse CSV text into rows keyed by trimmed header. Skips any preamble before the header line that contains `headerHint`. */
export function parseRows(text: string, headerHint?: string): Row[] {
  let src = text.replace(/^﻿/, "");
  if (headerHint) {
    const lines = src.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.includes(headerHint));
    if (idx > 0) src = lines.slice(idx).join("\n");
  }
  const res = Papa.parse<Row>(src, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  return res.data;
}

export function parseDate(s: string | undefined): number | undefined {
  if (!s || !s.trim()) return undefined;
  const t = Date.parse(s.trim());
  return Number.isNaN(t) ? undefined : t;
}

export function parseIntOpt(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number.parseInt(s.trim(), 10);
  return Number.isNaN(n) ? undefined : n;
}

export function parseNum(s: string | undefined): number | undefined {
  if (!s || !s.trim()) return undefined;
  const n = Number(s.trim());
  return Number.isNaN(n) ? undefined : n;
}

const norm = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Find the value of the first column whose normalized header equals one of the aliases. */
function pick(row: Row, aliases: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const k = keys.find((key) => norm(key) === a);
    if (k !== undefined) {
      const v = row[k];
      if (v !== undefined && v.trim() !== "") return v.trim();
    }
  }
  return undefined;
}

function mapStatus(s: string | undefined): TrackStatus | undefined {
  if (!s) return undefined;
  const v = s.toLowerCase().replace(/[^a-z]/g, "");
  if (/^(watching|inprogress|current)/.test(v)) return "watching";
  if (/(watchlist|planto|wanttowatch|planned|towatch)/.test(v)) return "watchlist";
  if (/(completed|watched|finished|seen)/.test(v)) return "completed";
  if (/(hold|paused)/.test(v)) return "paused";
  if (/dropped/.test(v)) return "dropped";
  return undefined;
}

function mapKind(s: string | undefined, hasEpisode: boolean): MediaKind {
  if (hasEpisode) return "show";
  const v = (s ?? "").toLowerCase();
  if (/(movie|film)/.test(v)) return "movie";
  if (/(show|series|tv|episode)/.test(v)) return "show";
  return "movie";
}

/** Multiplier for a file's rating scale, inferred from the max rating: <=5 stars -> x2, <=10 as-is, <=100 -> /10. */
function scaleFor(max: number): number {
  if (max <= 5) return 2;
  if (max <= 10) return 1;
  return 0.1;
}
const applyScale = (n: number | undefined, k: number): number | undefined =>
  n === undefined || n <= 0 ? undefined : Math.min(10, Math.max(1, Math.round(n * k)));

export const importCsv: Importer = async (files) => {
  const b: ImportBundle = emptyBundle("csv");
  let skipped = 0;
  for (const f of files) {
    const rows = parseRows(await f.text());
    const maxRating = rows.reduce((m, r) => Math.max(m, parseNum(pick(r, ["rating", "yourrating", "score"])) ?? 0), 0);
    const k = scaleFor(maxRating);
    for (const row of rows) {
      const title = pick(row, ["title", "name", "showtitle", "show", "movie"]);
      const imdbRaw = pick(row, ["imdb", "imdbid", "imdbconst", "const"]);
      if (!title && !imdbRaw) { skipped++; continue; }
      const ids: ExternalIds = {};
      if (imdbRaw && /^tt\d+$/.test(imdbRaw)) ids.imdb = imdbRaw;
      const tmdb = parseIntOpt(pick(row, ["tmdb", "tmdbid"]));
      if (tmdb !== undefined) ids.tmdb = tmdb;
      const tvdb = parseIntOpt(pick(row, ["tvdb", "tvdbid"]));
      if (tvdb !== undefined) ids.tvdb = tvdb;
      const season = parseIntOpt(pick(row, ["season", "seasonnumber"]));
      const number = parseIntOpt(pick(row, ["episode", "episodenumber", "ep"]));
      const isEp = season !== undefined && number !== undefined;
      const kind = mapKind(pick(row, ["type", "kind", "titletype", "mediatype"]), isEp);
      const year = parseIntOpt(pick(row, ["year"]));
      const watchedAt = parseDate(pick(row, ["watchedat", "watcheddate", "date", "daterated", "datewatched"]));
      const rating = applyScale(parseNum(pick(row, ["rating", "yourrating", "score"])), k);
      const status = mapStatus(pick(row, ["status", "state", "list"]));
      const name = title ?? imdbRaw ?? "";
      if (isEp) {
        b.watches.push({ kind: "episode", title: name, year, ids, season, number, watchedAt });
        if (rating !== undefined) b.episodeRatings.push({ showIds: ids, showTitle: name, season, number, rating });
        continue;
      }
      const item: ImportedItem = { kind, title: name, year, ids };
      if (status) item.status = status;
      if (rating !== undefined) item.rating = rating;
      if (watchedAt !== undefined) item.addedAt = watchedAt;
      b.items.push(item);
      if (kind === "movie" && (status === "completed" || (status === undefined && watchedAt !== undefined))) {
        b.watches.push({ kind: "movie", title: name, year, ids, watchedAt });
      }
    }
  }
  if (skipped > 0) b.warnings.push(`skipped ${skipped} rows without a title or IMDb id`);
  return b;
};
