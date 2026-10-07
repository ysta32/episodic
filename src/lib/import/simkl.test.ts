import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { importSimkl } from "./simkl";
import type { InputFile } from "./types";

const file = (name: string, value: unknown): InputFile => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return { name, text: async () => text, bytes: async () => new TextEncoder().encode(text) };
};

describe("importSimkl", () => {
  it("imports shows, anime and movies, mapping every supported status", async () => {
    const fixture = await readFile(new URL("./fixtures/simkl/backup.json", import.meta.url), "utf8");
    const result = await importSimkl([file("backup.json", fixture)]);
    expect(result.source).toBe("simkl");
    expect(result.items).toHaveLength(6);
    expect(result.items.map((item) => item.status)).toEqual(["watching", "watchlist", "paused", "dropped", "completed", "completed"]);
    expect(result.items[0]).toMatchObject({ kind: "show", title: "Orbit", year: 2020, rating: 8, ids: { simkl: 101, tvdb: 201, tmdb: 301, imdb: "tt0000101" } });
    expect(result.items[4]).toMatchObject({ kind: "show", rating: 10 });
    expect(result.watches).toHaveLength(3);
    expect(result.watches[0]).toMatchObject({ kind: "episode", season: 0, number: 1, watchedAt: Date.parse("2024-02-01T10:00:00Z") });
    expect(result.watches[2]).toMatchObject({ kind: "movie", title: "Film", watchedAt: Date.parse("2024-03-01T12:00:00Z") });
    expect(result.warnings).toEqual([]);
  });

  it("detects CSV by headers independent of filename, including quoted titles", async () => {
    const fixture = await readFile(new URL("./fixtures/simkl/export.csv", import.meta.url), "utf8");
    const result = await importSimkl([file("download.txt", fixture)]);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ kind: "movie", title: "Film, Two", year: 2022, status: "completed", rating: 9, ids: { imdb: "tt0000201", tmdb: 201 } });
    expect(result.items[1]).toMatchObject({ kind: "show", status: "watchlist" });
    expect(result.items[1].rating).toBeUndefined();
    expect(result.items[2]).toMatchObject({ kind: "show", status: "paused", rating: 10 });
    expect(result.watches).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it("accepts Status and Watchlist/Status headers with case and whitespace variations", async () => {
    const result = await importSimkl([
      file("one.csv", '\uFEFF Title , TYPE , Status , SIMKL ID , Rating\r\nOne,TV,watching,12,0.5\r\n'),
      file("two.csv", "Title,Type,Watchlist/Status,TVDB ID\nTwo,Anime,dropped,123\n"),
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ status: "watching", ids: { simkl: 12 }, rating: 1 });
    expect(result.items[1]).toMatchObject({ status: "dropped", ids: { tvdb: 123 } });
  });

  it("accepts multiple JSON files with media types from names or shapes", async () => {
    const result = await importSimkl([
      file("movies.json", [{ title: "Movie", status: "plantowatch", ids: { simkl: "11" }, user_rating: 0 }]),
      file("data.txt", [{ show: { title: "Show", ids: { tvdb: 22 } }, status: "hold" }]),
      file("anime.json", [{ title: "Anime", status: "completed" }]),
    ]);
    expect(result.items.map((item) => item.kind)).toEqual(["movie", "show", "show"]);
    expect(result.items[0].ids).toEqual({ simkl: 11 });
    expect(result.items[0].rating).toBeUndefined();
    expect(result.watches).toEqual([]);
  });

  it("warns for malformed files, records, episodes and unrecognized CSV", async () => {
    const result = await importSimkl([
      file("bad.json", "{"), file("other.csv", "Title,Year\nOther,2020"),
      file("backup.json", { movies: null, shows: [null, { show: {} }, { show: { title: "Valid" }, status: "unknown", seasons: [null, { number: 1, episodes: [{ number: -1 }, { number: 2, watched_at: "bad date" }] }] }] }),
      file("bad.csv", "Title,Type,Status\nExtra,movie,completed,extra\nGood,movie,completed"),
      { name: "unreadable", text: async () => { throw new Error("read failed"); }, bytes: async () => new Uint8Array() },
    ]);
    expect(result.items.map((item) => item.title)).toEqual(["Valid", "Good"]);
    expect(result.watches).toHaveLength(2);
    expect(result.watches[0].watchedAt).toBeUndefined();
    expect(result.warnings).toHaveLength(10);
  });

  it("handles empty input and invalid IDs and ratings", async () => {
    expect((await importSimkl([])).items).toEqual([]);
    const result = await importSimkl([file("movies.json", [{ title: "Film", ids: { simkl: true, tvdb: -4, tmdb: "5", imdb: "bad" }, user_rating: -1 }])]);
    expect(result.items[0].ids).toEqual({ tmdb: 5 });
    expect(result.items[0].rating).toBeUndefined();
  });
});
