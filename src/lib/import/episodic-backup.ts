// Importer for Episodic's own exportJson() backups (generic ImportBundle flow; see restoreBackup for lossless restore).
import { parseBackup, type EpisodicBackup } from "../export";
import { idsFromCanonical, parseEpisodeId } from "../library";
import type { ExternalIds } from "../types";
import { emptyBundle, type ImportBundle, type Importer, type InputFile } from "./types";

function looksLikeBackup(text: string): boolean {
  return /"format"\s*:\s*"episodic-backup"/.test(text.slice(0, 4096));
}

export function backupToBundle(b: EpisodicBackup): ImportBundle {
  const bundle = emptyBundle("episodic");
  const lib = new Map(b.library.map((e) => [e.id, e]));
  const shows = new Map((b.shows ?? []).map((s) => [s.id, s]));
  const movies = new Map((b.movies ?? []).map((m) => [m.id, m]));
  const describe = (id: string): { title: string; year?: number; ids: ExternalIds } => {
    const meta = shows.get(id) ?? movies.get(id);
    const e = lib.get(id);
    return { title: e?.title ?? meta?.title ?? id, year: meta?.year, ids: { ...meta?.ids, ...e?.ids, ...idsFromCanonical(id) } };
  };

  for (const e of b.library) {
    const { year, ids } = describe(e.id);
    bundle.items.push({ kind: e.kind, title: e.title, year, ids, status: e.status, rating: e.rating, favorite: e.favorite, addedAt: e.addedAt });
  }

  let skipped = 0;
  for (const w of b.watches) {
    const watchedAt = w.watchedAt > 0 ? w.watchedAt : undefined;
    if (w.kind === "movie") {
      const m = describe(w.mediaId);
      bundle.watches.push({ kind: "movie", title: m.title, year: m.year, ids: m.ids, watchedAt });
      continue;
    }
    const ep = parseEpisodeId(w.mediaId);
    if (!ep) {
      skipped++;
      continue;
    }
    const s = describe(w.showId ?? ep.showId);
    bundle.watches.push({ kind: "episode", title: s.title, year: s.year, ids: s.ids, season: ep.season, number: ep.number, watchedAt });
  }

  for (const r of b.ratings) {
    if (r.kind === "episode") {
      const ep = parseEpisodeId(r.mediaId);
      if (!ep) {
        skipped++;
        continue;
      }
      const s = describe(ep.showId);
      bundle.episodeRatings.push({ showIds: s.ids, showTitle: s.title, season: ep.season, number: ep.number, rating: r.rating });
    } else if (!lib.has(r.mediaId)) {
      const m = describe(r.mediaId);
      bundle.items.push({ kind: r.kind, title: m.title, year: m.year, ids: m.ids, rating: r.rating });
    }
  }

  for (const l of b.lists) {
    bundle.lists.push({
      name: l.name,
      items: l.items.map((it) => {
        const m = describe(it.id);
        return { kind: it.kind, title: it.title, year: m.year, ids: m.ids };
      }),
    });
  }

  if (skipped) bundle.warnings.push(`skipped ${skipped} rows with unrecognized episode ids`);
  if (b.settings) bundle.warnings.push("settings are not applied by the generic import; use Restore backup to restore them");
  return bundle;
}

export const importEpisodicBackup: Importer = async (files: InputFile[]) => {
  let lastError: Error | null = null;
  for (const f of files) {
    const text = await f.text();
    if (!f.name.toLowerCase().endsWith(".json") && !looksLikeBackup(text)) continue;
    try {
      return backupToBundle(parseBackup(text));
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("No Episodic backup (.json) found in the selected files");
};
