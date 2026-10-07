// Library engine: applies import bundles and tracks watches/status/ratings in the local DB.
import { db } from "./db";
import { parseBackup } from "./export";
import type { ImportBundle, ImportedItem, ImportedWatch } from "./import/types";
import type { MetadataProvider } from "./meta/types";
import type {
  Episode,
  ExternalIds,
  LibraryEntry,
  MediaKind,
  Movie,
  Rating,
  Show,
  TrackStatus,
  UserList,
  WatchEvent,
} from "./types";

// ---------------------------------------------------------------------------
// helpers

/** Deterministic 53-bit string hash (cyrb53) rendered as hex. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, "0");
}

/** UTC day key; 0/unknown dates collapse to "0". */
function dayKey(at: number): string {
  if (!at || !Number.isFinite(at)) return "0";
  return new Date(at).toISOString().slice(0, 10);
}

/** Deterministic watch id: same item watched on the same (UTC) day is one event. */
export function watchId(kind: WatchEvent["kind"], mediaId: string, watchedAt: number): string {
  return `w_${hashString(`${kind}|${mediaId}|${dayKey(watchedAt)}`)}`;
}

export function episodeId(showId: string, season: number, number: number): string {
  return `${showId}:s${season}e${number}`;
}

/** Parse "<showId>:s<season>e<number>". */
export function parseEpisodeId(id: string): { showId: string; season: number; number: number } | null {
  const m = /^(.+):s(\d+)e(\d+)$/.exec(id);
  if (!m) return null;
  return { showId: m[1], season: Number(m[2]), number: Number(m[3]) };
}

/** ExternalIds implied by a canonical id ("tvmaze:1", "tmdb:2", "imdb:tt..."). */
export function idsFromCanonical(id: string): ExternalIds {
  const idx = id.indexOf(":");
  if (idx < 0) return {};
  const prefix = id.slice(0, idx);
  const rest = id.slice(idx + 1);
  const num = Number(rest);
  switch (prefix) {
    case "tvmaze":
      return Number.isInteger(num) ? { tvmaze: num } : {};
    case "tmdb":
      return Number.isInteger(num) ? { tmdb: num } : {};
    case "tvdb":
      return Number.isInteger(num) ? { tvdb: num } : {};
    case "imdb":
      return /^tt\d+$/.test(rest) ? { imdb: rest } : {};
    default:
      return {};
  }
}

function todayISO(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function isAired(ep: Episode, now = Date.now()): boolean {
  if (ep.airstamp) {
    const t = Date.parse(ep.airstamp);
    if (Number.isFinite(t)) return t <= now;
  }
  if (ep.airdate) return ep.airdate <= todayISO(now);
  return false;
}

const byOrder = (a: Episode, b: Episode) => a.season - b.season || a.number - b.number;

function validRating(r: number | undefined): r is number {
  return typeof r === "number" && Number.isFinite(r) && r >= 1 && r <= 10;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------------
// applyImport

export interface ApplyImportResult {
  added: number;
  watches: number;
  ratings: number;
  lists: number;
  unresolved: string[];
}

interface ResolveReq {
  key: string;
  kind: MediaKind;
  title: string;
  year?: number;
  ids: ExternalIds;
}

function resolveKey(kind: MediaKind, ids: ExternalIds, title: string, year?: number): string {
  const sortedIds = Object.entries(ids)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return `${kind}|${JSON.stringify(sortedIds)}|${title.trim().toLowerCase()}|${year ?? ""}`;
}

export async function applyImport(
  bundle: ImportBundle,
  meta: MetadataProvider,
  onProgress?: (done: number, total: number) => void,
): Promise<ApplyImportResult> {
  const d = db();
  const now = Date.now();

  // 1. collect distinct titles to resolve
  const reqs = new Map<string, ResolveReq>();
  const want = (kind: MediaKind, ids: ExternalIds, title: string, year?: number): string => {
    const key = resolveKey(kind, ids, title, year);
    if (!reqs.has(key)) reqs.set(key, { key, kind, title, year, ids });
    return key;
  };
  const itemKeys = bundle.items.map((it) => want(it.kind, it.ids, it.title, it.year));
  const watchKeys = bundle.watches.map((w) => want(w.kind === "episode" ? "show" : "movie", w.ids, w.title, w.year));
  const epRatingKeys = bundle.episodeRatings.map((r) => want("show", r.showIds, r.showTitle));
  const listKeys = bundle.lists.map((l) => l.items.map((it) => want(it.kind, it.ids, it.title, it.year)));

  const reqList = [...reqs.values()];
  const showsNeedingEpisodes = new Set<string>();
  let done = 0;
  let total = reqList.length;
  const tick = () => {
    done++;
    onProgress?.(done, total);
  };

  // 2. resolve (concurrency 4, memoized per distinct key)
  const resolved = new Map<string, string | null>();
  await pool(reqList, 4, async (r) => {
    let id: string | null = null;
    try {
      id = await meta.resolve(r.kind, r.ids, r.title, r.year);
    } catch {
      id = null;
    }
    if (!id && r.kind === "movie" && r.ids.imdb) id = `imdb:${r.ids.imdb}`;
    resolved.set(r.key, id);
    tick();
  });
  const unresolvedSet = new Set<string>();
  for (const r of reqList) if (!resolved.get(r.key)) unresolvedSet.add(r.year ? `${r.title} (${r.year})` : r.title);

  bundle.watches.forEach((w, i) => {
    const id = resolved.get(watchKeys[i]);
    if (id && w.kind === "episode") showsNeedingEpisodes.add(id);
  });
  bundle.episodeRatings.forEach((_, i) => {
    const id = resolved.get(epRatingKeys[i]);
    if (id) showsNeedingEpisodes.add(id);
  });

  // 3. fetch metadata rows (shows/movies missing locally, episodes for watched shows)
  const showReqs = new Map<string, ResolveReq>();
  const movieReqs = new Map<string, ResolveReq>();
  for (const r of reqList) {
    const id = resolved.get(r.key);
    if (!id) continue;
    if (r.kind === "show" && !showReqs.has(id)) showReqs.set(id, r);
    if (r.kind === "movie" && !movieReqs.has(id)) movieReqs.set(id, r);
  }
  const existingShows = new Set((await d.shows.bulkGet([...showReqs.keys()])).filter((s): s is Show => !!s).map((s) => s.id));
  const existingMovies = new Set((await d.movies.bulkGet([...movieReqs.keys()])).filter((m): m is Movie => !!m).map((m) => m.id));
  const showFetch = [...showReqs.keys()].filter((id) => !existingShows.has(id));
  const movieFetch = [...movieReqs.keys()].filter((id) => !existingMovies.has(id));
  const epFetch = [...showsNeedingEpisodes];
  total += showFetch.length + movieFetch.length + epFetch.length;
  onProgress?.(done, total);

  const newShows: Show[] = [];
  const newMovies: Movie[] = [];
  const episodesByShow = new Map<string, Episode[]>();
  type Job = { t: "show" | "movie" | "eps"; id: string };
  const jobs: Job[] = [
    ...showFetch.map((id): Job => ({ t: "show", id })),
    ...movieFetch.map((id): Job => ({ t: "movie", id })),
    ...epFetch.map((id): Job => ({ t: "eps", id })),
  ];
  await pool(jobs, 4, async (job) => {
    try {
      if (job.t === "show") {
        const s = await meta.getShow(job.id);
        const r = showReqs.get(job.id);
        newShows.push(
          s ?? { id: job.id, kind: "show", title: r?.title ?? job.id, year: r?.year, ids: { ...r?.ids, ...idsFromCanonical(job.id) }, fetchedAt: 0 },
        );
      } else if (job.t === "movie") {
        const m = job.id.startsWith("imdb:") ? null : await meta.getMovie(job.id);
        const r = movieReqs.get(job.id);
        newMovies.push(
          m ?? { id: job.id, kind: "movie", title: r?.title ?? job.id, year: r?.year, ids: { ...r?.ids, ...idsFromCanonical(job.id) }, fetchedAt: 0 },
        );
      } else {
        episodesByShow.set(job.id, await meta.getEpisodes(job.id));
      }
    } catch {
      // Metadata failure is non-fatal: fall back to minimal rows / constructed episode ids.
      if (job.t === "show") {
        const r = showReqs.get(job.id);
        newShows.push({ id: job.id, kind: "show", title: r?.title ?? job.id, year: r?.year, ids: { ...r?.ids, ...idsFromCanonical(job.id) }, fetchedAt: 0 });
      } else if (job.t === "movie") {
        const r = movieReqs.get(job.id);
        newMovies.push({ id: job.id, kind: "movie", title: r?.title ?? job.id, year: r?.year, ids: { ...r?.ids, ...idsFromCanonical(job.id) }, fetchedAt: 0 });
      }
    }
    tick();
  });

  const epLookup = (showId: string, season: number, number: number): string => {
    const eps = episodesByShow.get(showId);
    const hit = eps?.find((e) => e.season === season && e.number === number);
    return hit ? hit.id : episodeId(showId, season, number);
  };

  // 4. build rows
  const result: ApplyImportResult = { added: 0, watches: 0, ratings: 0, lists: 0, unresolved: [...unresolvedSet].sort() };

  interface EntryPlan { kind: MediaKind; title: string; ids: ExternalIds; status?: TrackStatus; derived?: TrackStatus; rating?: number; favorite?: boolean; addedAt?: number }
  const entryPlans = new Map<string, EntryPlan>();
  const plan = (id: string, kind: MediaKind, title: string, ids: ExternalIds): EntryPlan => {
    let p = entryPlans.get(id);
    if (!p) {
      p = { kind, title, ids: { ...idsFromCanonical(id) } };
      entryPlans.set(id, p);
    }
    p.ids = { ...ids, ...p.ids };
    return p;
  };
  bundle.items.forEach((it: ImportedItem, i) => {
    const id = resolved.get(itemKeys[i]);
    if (!id) return;
    const p = plan(id, it.kind, it.title, it.ids);
    if (it.status) p.status = it.status;
    if (validRating(it.rating)) p.rating = it.rating;
    if (it.favorite !== undefined) p.favorite = it.favorite;
    if (it.addedAt && (!p.addedAt || it.addedAt < p.addedAt)) p.addedAt = it.addedAt;
  });

  const watchRows: WatchEvent[] = [];
  bundle.watches.forEach((w: ImportedWatch, i) => {
    const id = resolved.get(watchKeys[i]);
    if (!id) return;
    const kind: MediaKind = w.kind === "episode" ? "show" : "movie";
    const p = plan(id, kind, w.title, w.ids);
    p.derived ??= kind === "show" ? "watching" : "completed";
    const at = w.watchedAt && Number.isFinite(w.watchedAt) ? w.watchedAt : 0;
    if (w.kind === "episode") {
      if (w.season === undefined || w.number === undefined) return;
      const mediaId = epLookup(id, w.season, w.number);
      watchRows.push({ id: watchId("episode", mediaId, at), kind: "episode", mediaId, showId: id, watchedAt: at, source: bundle.source });
    } else {
      watchRows.push({ id: watchId("movie", id, at), kind: "movie", mediaId: id, watchedAt: at, source: bundle.source });
    }
  });

  const ratingRows: Rating[] = [];
  for (const [id, p] of entryPlans) {
    if (validRating(p.rating)) ratingRows.push({ id: `${p.kind}:${id}`, kind: p.kind, mediaId: id, rating: p.rating, ratedAt: p.addedAt ?? now });
  }
  bundle.episodeRatings.forEach((r, i) => {
    const showId = resolved.get(epRatingKeys[i]);
    if (!showId || !validRating(r.rating)) return;
    const mediaId = epLookup(showId, r.season, r.number);
    ratingRows.push({ id: `episode:${mediaId}`, kind: "episode", mediaId, rating: r.rating, ratedAt: now });
  });

  const listRows: UserList[] = bundle.lists.map((l, li) => {
    const items: UserList["items"] = [];
    const seen = new Set<string>();
    l.items.forEach((it, ii) => {
      const id = resolved.get(listKeys[li][ii]);
      if (!id || seen.has(id)) return;
      seen.add(id);
      items.push({ kind: it.kind, id, title: it.title, addedAt: now });
    });
    return { id: `list_${hashString(l.name.trim().toLowerCase())}`, name: l.name, items, createdAt: now, updatedAt: now };
  });

  // 5. write everything atomically
  await d.transaction("rw", [d.library, d.watches, d.ratings, d.lists, d.shows, d.episodes, d.movies], async () => {
    if (newShows.length) await d.shows.bulkPut(newShows);
    if (newMovies.length) await d.movies.bulkPut(newMovies);
    for (const eps of episodesByShow.values()) if (eps.length) await d.episodes.bulkPut(eps);

    const ids = [...entryPlans.keys()];
    const existing = await d.library.bulkGet(ids);
    const entries: LibraryEntry[] = ids.map((id, i) => {
      const p = entryPlans.get(id)!;
      const prev = existing[i];
      if (!prev) result.added++;
      const status: TrackStatus = p.status ?? prev?.status ?? p.derived ?? "watchlist";
      return {
        id,
        kind: p.kind,
        status,
        addedAt: prev ? Math.min(prev.addedAt, p.addedAt ?? prev.addedAt) : p.addedAt ?? now,
        updatedAt:
          prev && prev.status === status && (p.rating === undefined || p.rating === prev.rating) && (p.favorite === undefined || p.favorite === prev.favorite)
            ? prev.updatedAt
            : now,
        rating: p.rating ?? prev?.rating,
        favorite: p.favorite ?? prev?.favorite,
        title: prev?.title ?? p.title,
        ids: { ...p.ids, ...prev?.ids },
      };
    });
    if (entries.length) await d.library.bulkPut(entries);

    const uniqueWatches = [...new Map(watchRows.map((w) => [w.id, w])).values()];
    const presentWatch = await d.watches.bulkGet(uniqueWatches.map((w) => w.id));
    const freshWatches = uniqueWatches.filter((_, i) => !presentWatch[i]);
    if (freshWatches.length) await d.watches.bulkAdd(freshWatches);
    result.watches = freshWatches.length;

    const uniqueRatings = [...new Map(ratingRows.map((r) => [r.id, r])).values()];
    const prevRatings = await d.ratings.bulkGet(uniqueRatings.map((r) => r.id));
    const ratingWrites = uniqueRatings
      .map((r, i) => {
        const prev = prevRatings[i];
        return prev && prev.rating === r.rating ? null : r;
      })
      .filter((r): r is Rating => r !== null);
    if (ratingWrites.length) await d.ratings.bulkPut(ratingWrites);
    result.ratings = ratingWrites.length;

    const mergedLists = new Map<string, UserList>();
    for (const l of listRows) {
      const prev = mergedLists.get(l.id) ?? (await d.lists.get(l.id));
      if (!prev) {
        mergedLists.set(l.id, l);
        result.lists++;
        continue;
      }
      const have = new Set(prev.items.map((x) => x.id));
      const extra = l.items.filter((x) => !have.has(x.id));
      if (extra.length) result.lists++;
      mergedLists.set(l.id, { ...prev, items: [...prev.items, ...extra], updatedAt: extra.length ? now : prev.updatedAt });
    }
    if (mergedLists.size) await d.lists.bulkPut([...mergedLists.values()]);
  });

  onProgress?.(total, total);
  return result;
}

// ---------------------------------------------------------------------------
// tracking

export interface FollowInput {
  id: string;
  kind: MediaKind;
  title: string;
  ids?: ExternalIds;
  status?: TrackStatus;
}

export async function follow(entry: FollowInput): Promise<LibraryEntry> {
  const d = db();
  const now = Date.now();
  return d.transaction("rw", d.library, async () => {
    const prev = await d.library.get(entry.id);
    const status: TrackStatus = entry.status ?? prev?.status ?? (entry.kind === "show" ? "watching" : "watchlist");
    const row: LibraryEntry = {
      ...prev,
      id: entry.id,
      kind: entry.kind,
      status,
      addedAt: prev?.addedAt ?? now,
      updatedAt: now,
      title: entry.title || prev?.title || entry.id,
      ids: { ...prev?.ids, ...idsFromCanonical(entry.id), ...entry.ids },
    };
    await d.library.put(row);
    return row;
  });
}

export async function unfollow(id: string): Promise<void> {
  await db().library.delete(id);
}

export async function setStatus(id: string, status: TrackStatus): Promise<void> {
  const n = await db().library.update(id, { status, updatedAt: Date.now() });
  if (n === 0) throw new Error(`Not in library: ${id}`);
}

export async function rate(kind: Rating["kind"], mediaId: string, rating: number): Promise<void> {
  if (!validRating(rating)) throw new RangeError(`Rating must be between 1 and 10, got ${rating}`);
  const d = db();
  const now = Date.now();
  await d.transaction("rw", d.ratings, d.library, async () => {
    await d.ratings.put({ id: `${kind}:${mediaId}`, kind, mediaId, rating, ratedAt: now });
    if (kind !== "episode") await d.library.update(mediaId, { rating, updatedAt: now });
  });
}

export async function markWatched(episodeIds: string[], at: number = Date.now()): Promise<number> {
  const d = db();
  if (!episodeIds.length) return 0;
  return d.transaction("rw", d.watches, d.episodes, d.library, async () => {
    const eps = await d.episodes.bulkGet(episodeIds);
    const rows: WatchEvent[] = [];
    const showIds = new Set<string>();
    episodeIds.forEach((mediaId, i) => {
      const showId = eps[i]?.showId ?? parseEpisodeId(mediaId)?.showId;
      if (!showId) throw new Error(`Unknown episode id: ${mediaId}`);
      showIds.add(showId);
      rows.push({ id: watchId("episode", mediaId, at), kind: "episode", mediaId, showId, watchedAt: at, source: "manual" });
    });
    const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
    const present = await d.watches.bulkGet(unique.map((r) => r.id));
    const fresh = unique.filter((_, i) => !present[i]);
    if (fresh.length) await d.watches.bulkAdd(fresh);
    for (const sid of showIds) {
      const e = await d.library.get(sid);
      if (e && e.status === "watchlist") await d.library.update(sid, { status: "watching", updatedAt: at });
      else if (e) await d.library.update(sid, { updatedAt: Math.max(e.updatedAt, at) });
    }
    return fresh.length;
  });
}

export async function unmarkWatched(episodeId: string): Promise<void> {
  await db().watches.where("mediaId").equals(episodeId).delete();
}

export async function markSeasonWatched(showId: string, season: number, at: number = Date.now()): Promise<number> {
  const d = db();
  const eps = await d.episodes.where("[showId+season]").equals([showId, season]).toArray();
  const watched = new Set((await d.watches.where("showId").equals(showId).toArray()).map((w) => w.mediaId));
  const todo = eps.filter((e) => isAired(e, at) && !watched.has(e.id)).sort(byOrder).map((e) => e.id);
  return markWatched(todo, at);
}

export async function markMovieWatched(movieId: string, at: number = Date.now()): Promise<void> {
  const d = db();
  await d.transaction("rw", d.watches, d.library, async () => {
    const id = watchId("movie", movieId, at);
    if (!(await d.watches.get(id))) await d.watches.add({ id, kind: "movie", mediaId: movieId, watchedAt: at, source: "manual" });
    const e = await d.library.get(movieId);
    if (e) await d.library.update(movieId, { status: "completed", updatedAt: at });
  });
}

export async function isWatched(mediaId: string): Promise<boolean> {
  return (await db().watches.where("mediaId").equals(mediaId).count()) > 0;
}

// ---------------------------------------------------------------------------
// up next / progress

export interface UpNextItem {
  show: Show;
  next: Episode;
  remaining: number;
}

export async function upNext(now: number = Date.now()): Promise<UpNextItem[]> {
  const d = db();
  const entries = await d.library.where("status").equals("watching").filter((e) => e.kind === "show").toArray();
  const out: { item: UpNextItem; activity: number }[] = [];
  for (const entry of entries) {
    const show = await d.shows.get(entry.id);
    if (!show) continue;
    const eps = (await d.episodes.where("showId").equals(entry.id).toArray()).filter((e) => e.season > 0).sort(byOrder);
    const watches = await d.watches.where("showId").equals(entry.id).toArray();
    const watched = new Set(watches.map((w) => w.mediaId));
    // Continue after the furthest watched episode (skipped gaps are not resurfaced).
    let lastIdx = -1;
    eps.forEach((e, i) => {
      if (watched.has(e.id)) lastIdx = i;
    });
    const candidates = eps.slice(lastIdx + 1).filter((e) => isAired(e, now) && !watched.has(e.id));
    if (!candidates.length) continue;
    // Most recent watch wins; follow/status time only for shows with no dated watches yet.
    const lastWatch = watches.reduce((m, w) => Math.max(m, w.watchedAt), 0);
    const activity = lastWatch > 0 ? lastWatch : entry.updatedAt;
    out.push({ item: { show, next: candidates[0], remaining: candidates.length }, activity });
  }
  out.sort((a, b) => b.activity - a.activity || a.item.show.title.localeCompare(b.item.show.title));
  return out.map((o) => o.item);
}

export async function progress(showId: string, now: number = Date.now()): Promise<{ watched: number; aired: number; pct: number }> {
  const d = db();
  const aired = (await d.episodes.where("showId").equals(showId).toArray()).filter((e) => e.season > 0 && isAired(e, now));
  const watchedIds = new Set((await d.watches.where("showId").equals(showId).toArray()).map((w) => w.mediaId));
  const watched = aired.filter((e) => watchedIds.has(e.id)).length;
  const pct = aired.length ? Math.round((watched / aired.length) * 100) : 0;
  return { watched, aired: aired.length, pct };
}

// ---------------------------------------------------------------------------
// lossless backup restore

/**
 * Validate an exportJson() backup and write every table back verbatim (ids, sources, settings preserved).
 * Merges into the current DB: rows with the same id are overwritten, other rows are kept.
 */
export async function restoreBackup(json: string): Promise<{ library: number; watches: number; ratings: number; lists: number }> {
  const b = parseBackup(json);
  const d = db();
  await d.transaction("rw", [d.library, d.watches, d.ratings, d.lists, d.settings, d.shows, d.episodes, d.movies], async () => {
    if (b.shows?.length) await d.shows.bulkPut(b.shows);
    if (b.episodes?.length) await d.episodes.bulkPut(b.episodes);
    if (b.movies?.length) await d.movies.bulkPut(b.movies);
    if (b.library.length) await d.library.bulkPut(b.library);
    if (b.watches.length) await d.watches.bulkPut(b.watches);
    if (b.ratings.length) await d.ratings.bulkPut(b.ratings);
    if (b.lists.length) await d.lists.bulkPut(b.lists);
    if (b.settings) await d.settings.put(b.settings);
  });
  return { library: b.library.length, watches: b.watches.length, ratings: b.ratings.length, lists: b.lists.length };
}
