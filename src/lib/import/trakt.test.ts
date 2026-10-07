import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { importTrakt } from "./trakt";
import type { InputFile } from "./types";

const file = (name: string, value: unknown): InputFile => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return { name, text: async () => text, bytes: async () => new TextEncoder().encode(text) };
};
const show = { title: "Orbit", year: 2020, ids: { trakt: 101, tvdb: 201, imdb: "tt0000101", tmdb: 301 } };
const movie = { title: "Film", year: 2021, ids: { trakt: 401, imdb: "tt0000401", tmdb: 501 } };

describe("importTrakt", () => {
  it("imports synthetic watched shows with special episodes, IDs and dates", async () => {
    const fixture = await readFile(new URL("./fixtures/trakt/watched-shows.json", import.meta.url), "utf8");
    const result = await importTrakt([file("watched-shows.json", fixture)]);
    expect(result.source).toBe("trakt");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ kind: "show", title: "Orbit", year: 2020, ids: show.ids, status: "watching" });
    expect(result.watches).toHaveLength(2);
    expect(result.watches[0]).toMatchObject({ kind: "episode", season: 0, number: 1, ids: show.ids, episodeIds: { tvdb: 901 }, watchedAt: Date.parse("2024-02-01T10:00:00Z") });
    expect(result.warnings).toEqual([]);
  });

  it("combines watched, watchlist, ratings and history files without duplicate library items", async () => {
    const result = await importTrakt([
      file("watchlist-shows.json", [{ show, listed_at: "2023-01-01T00:00:00Z" }]),
      file("ratings-shows.json", [{ show, rating: 9 }]),
      file("history-episodes.json", [{ show, episode: { season: 1, number: 2, ids: { tvdb: 999 } }, watched_at: "2024-01-01T00:00:00Z" }]),
      file("watched-movies.json", [{ movie, plays: 1, last_watched_at: "2024-02-01T00:00:00Z" }]),
      file("history-movies.json", [{ movie, watched_at: "2024-02-01T00:00:00Z" }, { movie, watched_at: "2024-03-01T00:00:00Z" }]),
      file("ratings-movies.json", [{ movie, rating: 20 }]),
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ status: "watching", rating: 9, addedAt: Date.parse("2023-01-01T00:00:00Z") });
    expect(result.items[1]).toMatchObject({ kind: "movie", status: "completed", rating: 10, ids: movie.ids });
    expect(result.watches).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });

  it("preserves watchlist status and ignores unrated values", async () => {
    const result = await importTrakt([file("watchlist-movies.json", [{ movie, rating: 0 }])]);
    expect(result.items[0]).toMatchObject({ status: "watchlist" });
    expect(result.items[0].rating).toBeUndefined();
    expect(result.watches).toEqual([]);
  });

  it("imports episode ratings without assigning them to shows or inventing watches", async () => {
    const result = await importTrakt([file("ratings-episodes.json", [{ show, episode: { season: 0, number: 1 }, rating: 8 }])]);
    expect(result.episodeRatings).toEqual([{ showIds: show.ids, showTitle: "Orbit", season: 0, number: 1, rating: 8 }]);
    expect(result.items[0].rating).toBeUndefined();
    expect(result.watches).toEqual([]);
  });

  it("imports named lists and filename-based list arrays", async () => {
    const result = await importTrakt([
      file("backup.json", { lists: [{ name: "Favorites", items: [{ show }, { movie }] }] }),
      file("lists-weekend.json", [{ movie }]),
    ]);
    expect(result.lists).toHaveLength(2);
    expect(result.lists[0]).toEqual({ name: "Favorites", items: [{ kind: "show", ...show }, { kind: "movie", ...movie }] });
    expect(result.lists[1].items).toHaveLength(1);
    expect(result.watches).toEqual([]);
  });

  it("detects wrapped data by shape", async () => {
    const result = await importTrakt([file("data.txt", { watched: { movies: [{ movie }] }, watchlist: [{ show }] })]);
    expect(result.items.map((item) => item.status)).toEqual(["completed", "watchlist"]);
    expect(result.watches).toHaveLength(1);
  });

  it("keeps list entries out of library items, ratings and watches", async () => {
    const library = file("watched-movies.json", [{ movie, rating: 8 }]);
    const list = file("lists-favorites.json", [
      { show, listed_at: "2024-01-01", rating: 2, seasons: [{ number: 1, episodes: [{ number: 1, rating: 3 }] }] },
      { movie, listed_at: "2024-01-01", rating: 1, watched_at: "2024-01-02" },
    ]);
    const baseline = await importTrakt([library]);
    for (const files of [[list], [library, list], [list, library]]) {
      const result = await importTrakt(files);
      expect(result.items).toEqual(files.length === 1 ? [] : baseline.items);
      expect(result.watches).toEqual(files.length === 1 ? [] : baseline.watches);
      expect(result.episodeRatings).toEqual([]);
      expect(result.lists[0].items).toEqual([{ kind: "show", ...show }, { kind: "movie", ...movie }]);
    }
  });

  it("warns on malformed entries and files, continuing with valid input", async () => {
    const result = await importTrakt([
      file("broken.json", "{"), file("unknown.json", { other: [] }),
      file("watched-shows.json", [null, { show: {} }, { show, seasons: [null, { number: -1, episodes: [{ number: 1 }] }, { number: 1, episodes: [{ number: 0 }, { number: 2, last_watched_at: "invalid" }] }] }]),
      { name: "unreadable.json", text: async () => { throw new Error("read failed"); }, bytes: async () => new Uint8Array() },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.watches).toHaveLength(1);
    expect(result.watches[0].watchedAt).toBeUndefined();
    expect(result.warnings).toHaveLength(8);
  });

  it("handles empty input and rejects invalid numeric IDs", async () => {
    expect((await importTrakt([])).items).toEqual([]);
    const result = await importTrakt([file("watchlist-movies.json", [{ movie: { title: "Test", ids: { trakt: -1, tmdb: "42", tvdb: true, imdb: "wrong" } } }])]);
    expect(result.items[0].ids).toEqual({ tmdb: 42 });
  });
});
