import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { importTvTime, parseDate } from "./tvtime";
import { bytesFile, expandZips } from "./zip";
import type { InputFile } from "./types";

const DIR = path.join(__dirname, "fixtures", "tvtime");
const load = (name: string, as = name): InputFile => bytesFile(as, new Uint8Array(readFileSync(path.join(DIR, name))));
const all = (): InputFile[] => readdirSync(DIR).filter((n) => n.endsWith(".csv")).map((n) => load(n));
const ms = (s: string) => Date.parse(s);

describe("importTvTime", () => {
  it("imports all fixture variants with correct counts", async () => {
    const b = await importTvTime(all());
    expect(b.source).toBe("tvtime");
    const eps = b.watches.filter((w) => w.kind === "episode");
    const movies = b.watches.filter((w) => w.kind === "movie");
    expect(eps).toHaveLength(7);
    expect(movies).toHaveLength(1);
    expect(movies[0]).toMatchObject({ title: "Inception", year: 2010, ids: { imdb: "tt1375666", tvdb: 1530 }, watchedAt: ms("2015-06-01T20:00:00Z") });
    expect(b.items).toHaveLength(5);
    expect(b.episodeRatings).toHaveLength(2);
  });

  it("dedupes episode watches across files keeping the earliest and merging ids", async () => {
    const b = await importTvTime(all());
    const find = (t: string, s: number, e: number) => b.watches.filter((w) => w.title === t && w.season === s && w.number === e);
    const bb11 = find("Breaking Bad", 1, 1);
    expect(bb11).toHaveLength(1);
    expect(bb11[0]).toMatchObject({ watchedAt: ms("2019-03-02T21:14:05Z"), ids: { tvdb: 81189 }, episodeIds: { tvdb: 349232 } });
    const bb12 = find("Breaking Bad", 1, 2);
    expect(bb12).toHaveLength(1);
    expect(bb12[0].watchedAt).toBe(ms("2019-03-01T19:00:00Z"));
    const dark11 = find("Dark", 1, 1);
    expect(dark11).toHaveLength(1);
    expect(dark11[0]).toMatchObject({ watchedAt: ms("2018-11-30T08:00:00Z"), ids: { tvdb: 334824 }, episodeIds: { tvdb: 6551631 } });
  });

  it("handles BOM and quoted commas", async () => {
    const b = await importTvTime([load("seen_episode.csv")]);
    const ldr = b.watches.filter((w) => w.title === "Love, Death & Robots");
    expect(ldr.map((w) => w.number).sort()).toEqual([1, 2]);
    expect(ldr.find((w) => w.number === 2)?.watchedAt).toBeUndefined();
    expect(b.watches.find((w) => w.title.startsWith("﻿"))).toBeUndefined();
    expect(b.watches.filter((w) => w.title === "Breaking Bad")).toHaveLength(2);
  });

  it("warns about unparseable rows", async () => {
    const b = await importTvTime(all());
    const w = b.warnings.join("\n");
    expect(w).toMatch(/seen_episode\.csv: skipped 1 row without a show title or id/);
    expect(w).toMatch(/seen_episode\.csv: skipped 1 row without a valid season\/episode number/);
    expect(w).toMatch(/seen_episode\.csv: .*unparseable date/);
    expect(w).toMatch(/tracking-prod-records-v2\.csv: skipped 1 row without a movie title/);
    expect(w).toMatch(/unknown entity type "podcast"/);
    expect(w).toMatch(/episode_vote\.csv: skipped 1 row without a numeric rating/);
  });

  it("maps followed shows to statuses, favorites and normalized ratings", async () => {
    const b = await importTvTime(all());
    const item = (t: string) => b.items.find((i) => i.title === t);
    expect(item("Breaking Bad")).toMatchObject({ kind: "show", status: "watching", favorite: true, rating: 10, ids: { tvdb: 81189 }, addedAt: ms("2019-03-01T18:00:00Z") });
    expect(item("Dark")).toMatchObject({ status: "dropped" });
    expect(item("Dark")?.favorite).toBeUndefined();
    expect(item("Love, Death & Robots")).toMatchObject({ status: "watching", ids: { tvdb: 355567 } });
    expect(item("Love, Death & Robots")?.favorite).toBeUndefined();
    expect(item("The Bear")).toMatchObject({ status: "watching", rating: 8 });
    expect(item("Crouching Tiger, Hidden Dragon")).toMatchObject({ kind: "movie", status: "watchlist", year: 2000, ids: { imdb: "tt0190332" } });
  });

  it("maps episode votes to 1..10 ratings", async () => {
    const b = await importTvTime([load("episode_vote.csv")]);
    expect(b.episodeRatings).toEqual([
      { showIds: { tvdb: 81189 }, showTitle: "Breaking Bad", season: 1, number: 1, rating: 10 },
      { showIds: { tvdb: 81189 }, showTitle: "Breaking Bad", season: 1, number: 2, rating: 6 },
    ]);
  });

  it("tolerates missing files and a single file", async () => {
    const b = await importTvTime([load("followed_tv_show.csv")]);
    expect(b.items).toHaveLength(3);
    expect(b.watches).toHaveLength(0);
    expect(b.warnings).toEqual([]);
    const empty = await importTvTime([]);
    expect(empty.items).toHaveLength(0);
    expect(empty.warnings[0]).toMatch(/No TV Time export files/);
  });

  it("matches file names case-insensitively", async () => {
    const b = await importTvTime([load("seen_episode.csv", "export/SEEN_EPISODE.CSV")]);
    expect(b.watches.length).toBe(4);
  });

  it("reads a zip export (nested folders, junk entries) identically to the CSVs", async () => {
    const entries: Record<string, Uint8Array> = { "__MACOSX/._seen_episode.csv": strToU8("junk") };
    for (const n of readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
      entries[`tvtime-gdpr/${n}`] = new Uint8Array(readFileSync(path.join(DIR, n)));
    }
    const zip = bytesFile("TVTime_export.zip", zipSync(entries));
    const fromZip = await importTvTime([zip]);
    const fromCsv = await importTvTime(all());
    expect(fromZip.watches).toHaveLength(8);
    expect(fromZip.items).toHaveLength(5);
    expect(fromZip.episodeRatings).toHaveLength(2);
    expect(fromZip.watches.length).toBe(fromCsv.watches.length);
  });

  it("expandZips passes non-zip files through and rejects corrupt zips", async () => {
    const f = bytesFile("a.csv", strToU8("x"));
    expect(await expandZips([f])).toEqual([f]);
    await expect(expandZips([bytesFile("bad.zip", strToU8("not a zip"))])).rejects.toThrow(/bad\.zip/);
  });

  it("parses TV Time date formats", () => {
    expect(parseDate("2019-03-02 21:14:05")).toBe(ms("2019-03-02T21:14:05Z"));
    expect(parseDate("2019-03-02")).toBe(ms("2019-03-02T00:00:00Z"));
    expect(parseDate("1551561245")).toBe(1551561245000);
    expect(parseDate(undefined)).toBeUndefined();
    expect(parseDate("garbage")).toBeNaN();
  });

  describe("cross-file entity resolution", () => {
    const csv = (name: string, body: string) => bytesFile(name, strToU8(body));

    it("does not merge distinct shows that share a title but have different TVDB ids", async () => {
      const b = await importTvTime([
        csv("tracking-prod-records.csv", "tv_show_name,episode_season_number,episode_number,created_at,s_id\nThe Office,1,1,2010-01-01 00:00:00,73244\nThe Office,1,1,2009-01-01 00:00:00,78107\n"),
        csv("followed_tv_show.csv", "tv_show_id,tv_show_name\n73244,The Office\n78107,The Office\n"),
      ]);
      expect(b.watches).toHaveLength(2);
      expect(b.watches.map((w) => w.ids.tvdb).sort()).toEqual([73244, 78107]);
      expect(b.items).toHaveLength(2);
      expect(b.items.map((i) => i.ids.tvdb).sort()).toEqual([73244, 78107]);
    });

    it("leaves a title-only row unmerged when its title is ambiguous across ids", async () => {
      const b = await importTvTime([
        csv("tracking-prod-records.csv", "tv_show_name,episode_season_number,episode_number,s_id\nThe Office,1,1,73244\nThe Office,1,1,78107\n"),
        csv("seen_episode.csv", "tv_show_name,episode_season_number,episode_number\nThe Office,1,1\n"),
      ]);
      expect(b.watches).toHaveLength(3);
    });

    it("merges a titled row and an id-only row for the same TVDB show (and a title-only row)", async () => {
      const b = await importTvTime([
        csv("tracking-prod-records.csv", "tv_show_name,episode_season_number,episode_number,created_at,s_id,episode_id\n,2,5,2020-05-01 00:00:00,81189,111\nBreaking Bad,2,5,2020-06-01 00:00:00,81189,\n"),
        csv("seen_episode.csv", "tv_show_name,episode_season_number,episode_number,created_at\nBreaking Bad,2,5,2020-07-01 00:00:00\n"),
        csv("followed_tv_show.csv", "tv_show_id,tv_show_name\n81189,\n81189,Breaking Bad\n"),
        csv("episode_vote.csv", "tv_show_id,tv_show_name,episode_season_number,episode_number,vote\n81189,,2,5,4\n,Breaking Bad,2,5,5\n"),
      ]);
      expect(b.watches).toHaveLength(1);
      expect(b.watches[0]).toMatchObject({ title: "Breaking Bad", ids: { tvdb: 81189 }, episodeIds: { tvdb: 111 }, watchedAt: Date.parse("2020-05-01T00:00:00Z") });
      expect(b.items).toHaveLength(1);
      expect(b.items[0]).toMatchObject({ title: "Breaking Bad", ids: { tvdb: 81189 } });
      expect(b.episodeRatings).toHaveLength(1);
      expect(b.episodeRatings[0]).toMatchObject({ showTitle: "Breaking Bad", showIds: { tvdb: 81189 }, rating: 10 });
    });
  });

  it("treats rows in a movie watchlist file without a type as watchlist items", async () => {
    const b = await importTvTime([
      bytesFile("movie_watchlist.csv", strToU8("movie_name,imdb_id,release_date,created_at\nDune,tt1160419,2021-10-22,2021-01-01 00:00:00\nArrival,tt2543164,2016-11-11,\n")),
      bytesFile("movies_to_watch.csv", strToU8("movie_name,type\nHeat,watched\nAlien,\n")),
    ]);
    expect(b.items.map((i) => [i.title, i.status]).sort()).toEqual([["Alien", "watchlist"], ["Arrival", "watchlist"], ["Dune", "watchlist"]]);
    expect(b.watches.map((w) => w.title)).toEqual(["Heat"]);
  });
});
