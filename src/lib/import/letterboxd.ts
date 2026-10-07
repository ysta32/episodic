import type { ExternalIds, MediaKind } from "../types";
import { emptyBundle, type ImportBundle, type ImportedItem, type Importer } from "./types";
import { parseDate, parseIntOpt, parseNum, parseRows } from "./csv";

const base = (name: string): string => name.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
const inListsDir = (name: string): boolean => /(^|\/)lists\//i.test(name.replace(/\\/g, "/"));

/**
 * Accepts already-expanded Letterboxd export files (zip expansion is handled upstream).
 */
export const importLetterboxd: Importer = async (files) => {
  const b: ImportBundle = emptyBundle("letterboxd");
  const items = new Map<string, ImportedItem>();
  const upsert = (title: string, year: number | undefined): ImportedItem => {
    const key = `${title.toLowerCase()}|${year ?? ""}`;
    let it = items.get(key);
    if (!it) {
      const ids: ExternalIds = {};
      it = { kind: "movie", title, year, ids };
      items.set(key, it);
    }
    return it;
  };
  const seenWatch = new Set<string>();
  let skipped = 0;

  for (const f of files) {
    const name = base(f.name);
    if (!name.endsWith(".csv")) continue;
    const text = await f.text();
    if (inListsDir(f.name)) {
      const rows = parseRows(text, "Position,");
      const list: { kind: MediaKind; title: string; year?: number; ids: ExternalIds }[] = [];
      let listName = name.replace(/\.csv$/, "");
      if (text.startsWith("Letterboxd list export")) {
        const meta = parseRows(text.split(/\r?\n/).slice(1).join("\n").split(/\r?\n\r?\n/)[0] ?? "");
        const n = meta[0]?.["Name"]?.trim();
        if (n) listName = n;
      }
      for (const r of rows) {
        const title = (r["Name"] ?? "").trim();
        if (!title) { skipped++; continue; }
        list.push({ kind: "movie", title, year: parseIntOpt(r["Year"]), ids: {} });
      }
      b.lists.push({ name: listName, items: list });
      continue;
    }
    if (!["watched.csv", "diary.csv", "ratings.csv", "watchlist.csv"].includes(name)) continue;
    for (const r of parseRows(text)) {
      const title = (r["Name"] ?? "").trim();
      if (!title) { skipped++; continue; }
      const year = parseIntOpt(r["Year"]);
      const it = upsert(title, year);
      if (name === "watched.csv") {
        it.status = "completed";
        const d = parseDate(r["Date"]);
        if (d !== undefined && it.addedAt === undefined) it.addedAt = d;
        const k = `${title}|${year ?? ""}|w`;
        if (!seenWatch.has(k)) { seenWatch.add(k); b.watches.push({ kind: "movie", title, year, ids: it.ids }); }
      } else if (name === "diary.csv") {
        it.status = "completed";
        const d = parseDate(r["Watched Date"]) ?? parseDate(r["Date"]);
        // a diary entry supersedes the undated entry from watched.csv
        const wk = `${title}|${year ?? ""}|w`;
        if (seenWatch.has(wk)) {
          const idx = b.watches.findIndex((w) => w.title === title && w.year === year && w.watchedAt === undefined);
          if (idx >= 0) b.watches[idx] = { ...b.watches[idx]!, watchedAt: d };
          else b.watches.push({ kind: "movie", title, year, ids: it.ids, watchedAt: d });
        } else {
          seenWatch.add(wk);
          b.watches.push({ kind: "movie", title, year, ids: it.ids, watchedAt: d });
        }
        const rt = parseNum(r["Rating"]);
        if (rt !== undefined && rt > 0 && it.rating === undefined) it.rating = Math.round(rt * 2);
      } else if (name === "ratings.csv") {
        const rt = parseNum(r["Rating"]);
        if (rt !== undefined && rt > 0) it.rating = Math.min(10, Math.max(1, Math.round(rt * 2)));
        if (!it.status) it.status = "completed";
      } else {
        if (!it.status) it.status = "watchlist";
        const d = parseDate(r["Date"]);
        if (d !== undefined) it.addedAt = d;
      }
    }
  }
  b.items = [...items.values()];
  if (skipped > 0) b.warnings.push(`skipped ${skipped} rows without a title`);
  return b;
};
