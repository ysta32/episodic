import type { ExternalIds, MediaKind } from "../types";
import { emptyBundle, type ImportBundle, type Importer } from "./types";
import { parseDate, parseIntOpt, parseNum, parseRows } from "./csv";

function kindOf(titleType: string): MediaKind | "episode" | undefined {
  const t = titleType.trim().toLowerCase();
  if (t === "tvepisode") return "episode";
  if (t === "tvseries" || t === "tvminiseries") return "show";
  if (t === "movie" || t === "tvmovie" || t === "short" || t === "tvshort" || t === "video") return "movie";
  return undefined;
}

export const importImdb: Importer = async (files) => {
  const b: ImportBundle = emptyBundle("imdb");
  let skipped = 0;
  let episodes = 0;
  for (const f of files) {
    const isWatchlist = /watchlist/i.test(f.name);
    for (const row of parseRows(await f.text())) {
      const konst = (row["Const"] ?? "").trim();
      const title = (row["Title"] ?? "").trim();
      if (!konst || !title) { skipped++; continue; }
      const kind = kindOf(row["Title Type"] ?? "");
      if (kind === "episode") { episodes++; continue; }
      if (!kind) { skipped++; continue; }
      const ids: ExternalIds = { imdb: konst };
      const year = parseIntOpt(row["Year"]);
      const rawRating = parseNum(row["Your Rating"]);
      const rating = rawRating !== undefined && rawRating >= 1 ? Math.min(10, Math.round(rawRating)) : undefined;
      const date = parseDate(row["Date Rated"]) ?? parseDate(row["Created"]);
      b.items.push({
        kind, title, year, ids,
        status: isWatchlist || rating === undefined ? "watchlist" : "completed",
        ...(rating !== undefined ? { rating } : {}),
        ...(date !== undefined ? { addedAt: date } : {}),
      });
      if (kind === "movie" && !isWatchlist && rating !== undefined) {
        b.watches.push({ kind: "movie", title, year, ids, watchedAt: date });
      }
    }
  }
  if (episodes > 0) b.warnings.push(`skipped ${episodes} individual episode rows (IMDb exports lack season/episode numbers)`);
  if (skipped > 0) b.warnings.push(`skipped ${skipped} unrecognized rows`);
  return b;
};
