// Watch statistics computed from the local DB. Calendar buckets use the device's local time zone.
import { db } from "./db";

export interface Stats {
  episodes: number;
  movies: number;
  minutes: number;
  shows: number;
  byMonth: Record<string, number>; // "YYYY-MM" -> watch count
  topGenres: [string, number][];
  streakDays: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const localMonth = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export async function computeStats(now: number = Date.now()): Promise<Stats> {
  const d = db();
  const [watches, episodes, shows, movies] = await Promise.all([
    d.watches.toArray(),
    d.episodes.toArray(),
    d.shows.toArray(),
    d.movies.toArray(),
  ]);
  const epMap = new Map(episodes.map((e) => [e.id, e]));
  const showMap = new Map(shows.map((s) => [s.id, s]));
  const movieMap = new Map(movies.map((m) => [m.id, m]));

  let episodeCount = 0;
  let movieCount = 0;
  let minutes = 0;
  const showIds = new Set<string>();
  const byMonth: Record<string, number> = {};
  const genres = new Map<string, number>();
  const days = new Set<string>();

  for (const w of watches) {
    if (w.kind === "episode") {
      episodeCount++;
      const ep = epMap.get(w.mediaId);
      const showId = w.showId ?? ep?.showId;
      const show = showId ? showMap.get(showId) : undefined;
      if (showId) showIds.add(showId);
      minutes += ep?.runtime ?? show?.runtime ?? 0;
      for (const g of show?.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + 1);
    } else {
      movieCount++;
      minutes += movieMap.get(w.mediaId)?.runtime ?? 0;
    }
    if (w.watchedAt > 0) {
      const m = localMonth(w.watchedAt);
      byMonth[m] = (byMonth[m] ?? 0) + 1;
      days.add(localDay(w.watchedAt));
    }
  }

  // Current streak: consecutive local days with a watch, ending today (or yesterday if nothing yet today).
  let streakDays = 0;
  const cursor = new Date(now);
  if (!days.has(localDay(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDay(cursor.getTime()))) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  return { episodes: episodeCount, movies: movieCount, minutes, shows: showIds.size, byMonth, topGenres, streakDays };
}
