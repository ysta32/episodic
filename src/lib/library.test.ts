import { beforeEach, describe, expect, it } from "vitest";
import { EpisodicDB, __setDb, db, DEFAULT_SETTINGS } from "./db";
import {
  applyImport,
  follow,
  isWatched,
  markMovieWatched,
  markSeasonWatched,
  markWatched,
  progress,
  rate,
  restoreBackup,
  setStatus,
  unmarkWatched,
  upNext,
  watchId,
} from "./library";
import { computeStats } from "./stats";
import { exportCsv, exportJson } from "./export";
import { importEpisodicBackup } from "./import/episodic-backup";
import type { ImportBundle, InputFile } from "./import/types";
import type { MetadataProvider } from "./meta/types";
import type { Episode, ExternalIds, Movie, Show } from "./types";

const DAY = 86_400_000;
const NOW = Date.now();
const past = (days: number) => new Date(NOW - days * DAY).toISOString().slice(0, 10);

const SHOWS: Show[] = [
  { id: "tvmaze:1", kind: "show", title: "Alpha", year: 2020, ids: { tvmaze: 1, tvdb: 100, imdb: "tt0000001" }, genres: ["Drama", "Sci-Fi"], runtime: 50, fetchedAt: 1 },
  { id: "tvmaze:2", kind: "show", title: "Beta", year: 2021, ids: { tvmaze: 2, tvdb: 200 }, genres: ["Comedy"], runtime: 25, fetchedAt: 1 },
];
const MOVIES: Movie[] = [{ id: "tmdb:10", kind: "movie", title: "Gamma", year: 2019, ids: { tmdb: 10, imdb: "tt0000010" }, runtime: 120, fetchedAt: 1 }];
const EPISODES: Record<string, Episode[]> = {
  "tvmaze:1": [
    { id: "tvmaze:1:s0e1", showId: "tvmaze:1", season: 0, number: 1, airdate: past(400) },
    { id: "tvmaze:1:s1e1", showId: "tvmaze:1", season: 1, number: 1, airdate: past(30) },
    { id: "tvmaze:1:s1e2", showId: "tvmaze:1", season: 1, number: 2, airdate: past(23) },
    { id: "tvmaze:1:s1e3", showId: "tvmaze:1", season: 1, number: 3, airdate: past(16), runtime: 60 },
    { id: "tvmaze:1:s1e4", showId: "tvmaze:1", season: 1, number: 4, airdate: past(-7) },
  ],
  "tvmaze:2": [
    { id: "tvmaze:2:s1e1", showId: "tvmaze:2", season: 1, number: 1, airdate: past(10) },
    { id: "tvmaze:2:s1e2", showId: "tvmaze:2", season: 1, number: 2, airdate: past(3) },
  ],
};

function stubMeta() {
  const calls = { resolve: 0, getEpisodes: 0 };
  const meta: MetadataProvider = {
    search: async () => [],
    getShow: async (id) => SHOWS.find((s) => s.id === id) ?? null,
    getMovie: async (id) => MOVIES.find((m) => m.id === id) ?? null,
    getEpisodes: async (id) => {
      calls.getEpisodes++;
      return EPISODES[id] ?? [];
    },
    schedule: async () => [],
    resolve: async (kind, ids: ExternalIds, title) => {
      calls.resolve++;
      const pool: (Show | Movie)[] = kind === "show" ? SHOWS : MOVIES;
      const hit = pool.find(
        (m) =>
          (ids.tvmaze !== undefined && m.ids.tvmaze === ids.tvmaze) ||
          (ids.tvdb !== undefined && m.ids.tvdb === ids.tvdb) ||
          (ids.tmdb !== undefined && m.ids.tmdb === ids.tmdb) ||
          (ids.imdb !== undefined && m.ids.imdb === ids.imdb) ||
          m.title.toLowerCase() === title.toLowerCase(),
      );
      return hit?.id ?? null;
    },
  };
  return { meta, calls };
}

const t = (daysAgo: number) => NOW - daysAgo * DAY;

function bundle(): ImportBundle {
  return {
    source: "tvtime",
    items: [
      { kind: "show", title: "Alpha", ids: { tvdb: 100 }, status: "watching", rating: 9, favorite: true, addedAt: t(60) },
      { kind: "movie", title: "Gamma", ids: { imdb: "tt0000010" }, rating: 7 },
      { kind: "show", title: "Nowhere Show", ids: { tvdb: 999 } },
    ],
    watches: [
      { kind: "episode", title: "Alpha", ids: { tvdb: 100 }, season: 1, number: 1, watchedAt: t(20) },
      { kind: "episode", title: "Alpha", ids: { tvdb: 100 }, season: 1, number: 2, watchedAt: t(2) },
      { kind: "episode", title: "Beta", ids: { tvdb: 200 }, season: 1, number: 1, watchedAt: t(1) },
      { kind: "episode", title: "Beta", ids: { tvdb: 200 }, season: 1, number: 1, watchedAt: t(1) + 1000 }, // same day dup
      { kind: "movie", title: "Gamma", ids: { imdb: "tt0000010" }, watchedAt: t(0) },
    ],
    episodeRatings: [{ showIds: { tvdb: 100 }, showTitle: "Alpha", season: 1, number: 1, rating: 8 }],
    lists: [{ name: "Faves", items: [{ kind: "show", title: "Alpha", ids: { tvdb: 100 } }, { kind: "movie", title: "Gamma", ids: { tmdb: 10 } }] }],
    warnings: [],
  };
}

let n = 0;
const freshDb = () => {
  const d = new EpisodicDB(`t06-${Date.now()}-${n++}`);
  __setDb(d);
  return d;
};
const fileOf = (name: string, text: string): InputFile => ({
  name,
  text: async () => text,
  bytes: async () => new TextEncoder().encode(text),
});
async function dumpTables() {
  const d = db();
  const sortById = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return {
    library: sortById(await d.library.toArray()),
    watches: sortById(await d.watches.toArray()),
    ratings: sortById(await d.ratings.toArray()),
    lists: sortById(await d.lists.toArray()),
    settings: await d.settings.toArray(),
    shows: sortById(await d.shows.toArray()),
    episodes: sortById(await d.episodes.toArray()),
    movies: sortById(await d.movies.toArray()),
  };
}

describe("library core", () => {
  beforeEach(() => {
    freshDb();
  });

  it("applies an import: resolves, stores rows, reports unresolved, progress callback", async () => {
    const { meta, calls } = stubMeta();
    const ticks: [number, number][] = [];
    const res = await applyImport(bundle(), meta, (d, tot) => ticks.push([d, tot]));
    expect(res).toEqual({ added: 3, watches: 4, ratings: 3, lists: 1, unresolved: ["Nowhere Show"] });
    // memoized: Alpha(tvdb100) item/watch/rating/list share a key; Gamma has 2 distinct id-shapes; Beta; Nowhere
    expect(calls.resolve).toBe(5);
    expect(calls.getEpisodes).toBe(2);
    expect(ticks.at(-1)?.[0]).toBe(ticks.at(-1)?.[1]);

    const alpha = await db().library.get("tvmaze:1");
    expect(alpha).toMatchObject({ status: "watching", rating: 9, favorite: true, addedAt: t(60), title: "Alpha" });
    expect((await db().library.get("tvmaze:2"))?.status).toBe("watching");
    expect((await db().library.get("tmdb:10"))?.status).toBe("completed");
    expect(await db().shows.count()).toBe(2);
    expect(await db().episodes.count()).toBe(7);
    expect(await isWatched("tvmaze:1:s1e2")).toBe(true);
    expect(await isWatched("tvmaze:1:s1e3")).toBe(false);
    expect((await db().ratings.get("episode:tvmaze:1:s1e1"))?.rating).toBe(8);
    const lists = await db().lists.toArray();
    expect(lists[0].items.map((i) => i.id)).toEqual(["tvmaze:1", "tmdb:10"]);
    const w = await db().watches.get(watchId("movie", "tmdb:10", t(0)));
    expect(w?.source).toBe("tvtime");
  });

  it("is idempotent on re-import", async () => {
    const { meta } = stubMeta();
    await applyImport(bundle(), meta);
    const before = await dumpTables();
    const res = await applyImport(bundle(), meta);
    expect(res).toEqual({ added: 0, watches: 0, ratings: 0, lists: 0, unresolved: ["Nowhere Show"] });
    expect(await dumpTables()).toEqual(before);
  });

  it("upNext, progress and tracking actions", async () => {
    const { meta } = stubMeta();
    await applyImport(bundle(), meta);

    let un = await upNext();
    // Beta watched most recently (1 day ago) vs Alpha (2 days ago)
    expect(un.map((u) => [u.show.id, u.next.id, u.remaining])).toEqual([
      ["tvmaze:2", "tvmaze:2:s1e2", 1],
      ["tvmaze:1", "tvmaze:1:s1e3", 1],
    ]);
    expect(await progress("tvmaze:1")).toEqual({ watched: 2, aired: 3, pct: 67 });

    expect(await markWatched(["tvmaze:1:s1e3"])).toBe(1);
    expect(await markWatched(["tvmaze:1:s1e3"])).toBe(0); // same day -> no duplicate
    un = await upNext();
    expect(un.map((u) => u.show.id)).toEqual(["tvmaze:2"]); // Alpha: only unaired e4 left
    expect(await progress("tvmaze:1")).toEqual({ watched: 3, aired: 3, pct: 100 });

    await unmarkWatched("tvmaze:1:s1e3");
    expect(await isWatched("tvmaze:1:s1e3")).toBe(false);

    await markSeasonWatched("tvmaze:2", 1);
    expect(await progress("tvmaze:2")).toEqual({ watched: 2, aired: 2, pct: 100 });

    await setStatus("tvmaze:1", "paused");
    expect((await upNext()).map((u) => u.show.id)).toEqual([]);
    await expect(setStatus("nope:1", "paused")).rejects.toThrow();

    await follow({ id: "tmdb:11", kind: "movie", title: "Delta" });
    expect((await db().library.get("tmdb:11"))?.status).toBe("watchlist");
    await markMovieWatched("tmdb:11");
    expect((await db().library.get("tmdb:11"))?.status).toBe("completed");
    expect(await isWatched("tmdb:11")).toBe(true);

    await rate("show", "tvmaze:2", 6);
    expect((await db().library.get("tvmaze:2"))?.rating).toBe(6);
    await expect(rate("show", "tvmaze:2", 11)).rejects.toThrow(RangeError);
  });

  it("computes stats", async () => {
    const { meta } = stubMeta();
    await applyImport(bundle(), meta);
    const s = await computeStats(NOW);
    expect(s.episodes).toBe(3);
    expect(s.movies).toBe(1);
    expect(s.shows).toBe(2);
    expect(s.minutes).toBe(50 + 50 + 25 + 120);
    expect(Object.values(s.byMonth).reduce((a, b) => a + b, 0)).toBe(4);
    expect(s.topGenres[0]).toEqual(["Drama", 2]);
    expect(s.topGenres).toContainEqual(["Comedy", 1]);
    expect(s.streakDays).toBe(3); // today, yesterday, 2 days ago
  });

  it("exports CSV with one row per watch", async () => {
    const { meta } = stubMeta();
    await applyImport(bundle(), meta);
    const csv = await exportCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("type,title,year,season,episode,watched_at,imdb,tvdb,tmdb,tvmaze,rating");
    expect(lines).toHaveLength(5);
    const firstEp = lines.find((l) => l.startsWith("episode,Alpha,2020,1,1,"));
    expect(firstEp).toBeDefined();
    expect(firstEp?.endsWith(",tt0000001,100,,1,8")).toBe(true);
    expect(lines.some((l) => l.startsWith("movie,Gamma,2019,,,") && l.endsWith(",tt0000010,,10,,7"))).toBe(true);
  });

  it("round-trips export -> generic re-import (importEpisodicBackup) into a fresh DB", async () => {
    const { meta } = stubMeta();
    await applyImport(bundle(), meta);
    const before = await dumpTables();
    const json = await exportJson();
    const parsed = JSON.parse(json) as { format: string; version: number };
    expect(parsed).toMatchObject({ format: "episodic-backup", version: 1 });

    freshDb();
    const b = await importEpisodicBackup([fileOf("episodic-backup.json", json)]);
    const res = await applyImport(b, stubMeta().meta);
    expect(res.unresolved).toEqual([]);
    expect(res.watches).toBe(4);
    const after = await dumpTables();
    expect(after.watches.map((w) => [w.id, w.mediaId, w.watchedAt])).toEqual(before.watches.map((w) => [w.id, w.mediaId, w.watchedAt]));
    expect(after.library.map((e) => [e.id, e.status, e.rating, e.favorite])).toEqual(before.library.map((e) => [e.id, e.status, e.rating, e.favorite]));
    expect(after.ratings.map((r) => [r.id, r.rating])).toEqual(before.ratings.map((r) => [r.id, r.rating]));
    expect(after.lists.map((l) => [l.name, l.items.map((i) => i.id)])).toEqual(before.lists.map((l) => [l.name, l.items.map((i) => i.id)]));
    expect(await upNext()).toHaveLength(2);

    // re-importing the backup on top is a no-op
    const again = await applyImport(await importEpisodicBackup([fileOf("b.json", json)]), stubMeta().meta);
    expect(again).toMatchObject({ added: 0, watches: 0, ratings: 0, lists: 0 });
  });

  it("restoreBackup is lossless (export -> restore into fresh DB deep-equals)", async () => {
    const { meta } = stubMeta();
    await applyImport(bundle(), meta);
    await db().settings.put({ ...DEFAULT_SETTINGS, displayName: "Stan", theme: "dark" });
    await markWatched(["tvmaze:1:s1e3"], t(0));
    const before = await dumpTables();
    const json = await exportJson();

    freshDb();
    const res = await restoreBackup(json);
    expect(res).toEqual({ library: 3, watches: 5, ratings: 3, lists: 1 });
    expect(await dumpTables()).toEqual(before);
  });

  it("rejects invalid backups", async () => {
    await expect(restoreBackup("{}")).rejects.toThrow(/Not a valid Episodic backup/);
    await expect(restoreBackup("nope")).rejects.toThrow(/not valid JSON/);
    await expect(importEpisodicBackup([fileOf("x.json", '{"format":"other"}')])).rejects.toThrow();
  });
});
