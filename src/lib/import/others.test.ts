import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { InputFile } from "./types";
import { importLetterboxd } from "./letterboxd";
import { importImdb } from "./imdb";
import { importCsv } from "./csv";
import { IMPORTERS } from "./index";

const dir = join(__dirname, "fixtures", "others");
const file = (name: string, as: string = name): InputFile => {
  const buf = readFileSync(join(dir, name));
  return { name: as, text: async () => buf.toString("utf8"), bytes: async () => new Uint8Array(buf) };
};

describe("letterboxd", () => {
  it("merges watched, diary, ratings, watchlist, lists", async () => {
    const b = await importLetterboxd([
      file("watched.csv"), file("diary.csv"), file("ratings.csv"), file("watchlist.csv"), file("list-heists.csv", "lists/heists.csv"),
    ]);
    expect(b.source).toBe("letterboxd");
    const heat = b.items.find((i) => i.title === "Heat");
    expect(heat).toMatchObject({ kind: "movie", year: 1995, status: "completed", rating: 9 });
    expect(b.items.find((i) => i.title === "Alien")?.rating).toBe(7);
    expect(b.items.find((i) => i.title === "Dune")?.status).toBe("watchlist");
    const heatWatches = b.watches.filter((w) => w.title === "Heat");
    expect(heatWatches).toHaveLength(1);
    expect(heatWatches[0]?.watchedAt).toBe(Date.parse("2024-02-28"));
    expect(b.lists).toHaveLength(1);
    expect(b.lists[0]?.name).toBe("Best Heists");
    expect(b.lists[0]?.items.map((i) => i.title)).toEqual(["Heat", "Ocean's Eleven"]);
  });
});

describe("imdb", () => {
  it("maps types and ratings", async () => {
    const b = await importImdb([file("imdb-ratings.csv"), file("imdb-watchlist.csv")]);
    expect(b.items.find((i) => i.title === "Breaking Bad")).toMatchObject({ kind: "show", rating: 10, ids: { imdb: "tt0903747" }, status: "completed" });
    expect(b.items.find((i) => i.title === "The Wire")?.kind).toBe("show");
    expect(b.items.find((i) => i.title === "Heat")?.kind).toBe("movie");
    expect(b.items.find((i) => i.title === "Pilot")).toBeUndefined();
    expect(b.items.find((i) => i.title === "The Shawshank Redemption")?.status).toBe("watchlist");
    expect(b.watches.map((w) => w.title)).toEqual(["Heat"]);
    expect(b.warnings.length).toBeGreaterThan(0);
  });
});

describe("generic csv", () => {
  it("fuzzy headers, episodes, ratings, status", async () => {
    const b = await importCsv([file("generic.csv")]);
    const eps = b.watches.filter((w) => w.kind === "episode");
    expect(eps).toHaveLength(2);
    expect(eps[1]).toMatchObject({ title: "Breaking Bad", season: 1, number: 2, ids: { imdb: "tt0903747" } });
    expect(b.items.find((i) => i.title === "Heat")).toMatchObject({ kind: "movie", rating: 9, status: "completed", ids: { tmdb: 949 } });
    expect(b.items.find((i) => i.title === "Dune")).toMatchObject({ kind: "movie", rating: 8, status: "watchlist" });
    expect(b.warnings.join(" ")).toMatch(/skipped 1/);
  });
});

describe("generic csv rating scale", () => {
  const mk = (text: string) => [{ name: "r.csv", text: async () => text, bytes: async () => new TextEncoder().encode(text) }];
  it("uses one scale per file and records episode ratings", async () => {
    const b = await importCsv(mk("title,type,rating\nA,movie,4.5\nB,movie,5\nC,movie,3\n"));
    expect(b.items.map((i) => i.rating)).toEqual([9, 10, 6]);
    const e = await importCsv(mk("title,season,episode,rating\nShow,1,2,4.5\nShow,1,3,5\n"));
    expect(e.episodeRatings).toEqual([
      { showIds: {}, showTitle: "Show", season: 1, number: 2, rating: 9 },
      { showIds: {}, showTitle: "Show", season: 1, number: 3, rating: 10 },
    ]);
    const t = await importCsv(mk("title,type,rating\nA,movie,7\nB,movie,10\n"));
    expect(t.items.map((i) => i.rating)).toEqual([7, 10]);
  });
});

describe("registry", () => {
  it("covers all sources", () => {
    expect(Object.keys(IMPORTERS).sort()).toEqual(["csv", "episodic", "imdb", "letterboxd", "simkl", "trakt", "tvtime"]);
  });
});
