import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EpisodicDB, __setDb } from "../db";
import { clientProvider } from "./index";
import { createTvmaze } from "./tvmaze";
import { createTmdb } from "./tmdb";

const mazeShow = { id: 42, name: "Example", premiered: "2020-01-02", summary: "<p>Hello <b>world</b>.</p>", status: "Running", externals: { imdb: "tt123", thetvdb: 98 }, image: { medium: "https://example.test/poster" }, webChannel: { name: "Stream" }, runtime: 45 };
const mazeEpisode = { id: 7, season: 2, number: 3, name: "Third", airdate: "2026-10-07", airstamp: "2026-10-07T20:00:00Z", summary: "<p>Episode</p>" };
const reply = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers });
const mockFetch = () => vi.fn<typeof fetch>();
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("TVmaze", () => {
  it("maps shows and episodes with canonical IDs and plain summaries", async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(reply(mazeShow)).mockResolvedValueOnce(reply([mazeEpisode, { ...mazeEpisode, number: null }]));
    const provider = createTvmaze(fetcher);
    expect(await provider.getShow("tvmaze:42")).toMatchObject({ id: "tvmaze:42", title: "Example", kind: "show", year: 2020, summary: "Hello world.", status: "running", network: "Stream", ids: { tvmaze: 42, imdb: "tt123", tvdb: 98 } });
    expect(await provider.getEpisodes("tvmaze:42")).toEqual([expect.objectContaining({ id: "tvmaze:42:s2e3", showId: "tvmaze:42", season: 2, number: 3, tvmazeId: 7, summary: "Episode" })]);
  });
  it("maps search results and encodes the query", async () => {
    const fetcher = mockFetch().mockResolvedValue(reply([{ show: mazeShow }]));
    expect(await createTvmaze(fetcher).search("A&B")).toMatchObject([{ id: "tvmaze:42", kind: "show", year: 2020 }]);
    expect(String(fetcher.mock.calls[0][0])).toContain("q=A%26B");
  });
  it.each([[{ imdb: "tt123" }, "imdb=tt123"], [{ tvdb: 98 }, "thetvdb=98"]] as const)("resolves external IDs before search: %j", async (ids, query) => {
    const fetcher = mockFetch().mockResolvedValue(reply(mazeShow));
    expect(await createTvmaze(fetcher).resolve("show", ids, "ignored")).toBe("tvmaze:42");
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://api.tvmaze.com/lookup/shows?${query}`);
  });
  it("tries TVDB after a missing IMDb ID and then prefers the title's matching year", async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(reply(null, 404)).mockResolvedValueOnce(reply(null, 404)).mockResolvedValueOnce(reply([
      { show: { ...mazeShow, id: 1, premiered: "1990-01-01" } }, { show: mazeShow },
    ]));
    expect(await createTvmaze(fetcher).resolve("show", { imdb: "tt999", tvdb: 999 }, "Example", 2020)).toBe("tvmaze:42");
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.tvmaze.com/lookup/shows?imdb=tt999", "https://api.tvmaze.com/lookup/shows?thetvdb=999", "https://api.tvmaze.com/search/shows?q=Example",
    ]);
  });
  it("returns null for unresolved titles, missing shows, and movies", async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply(null, 404));
    const provider = createTvmaze(fetcher);
    expect(await provider.resolve("show", {}, "Missing")).toBeNull();
    expect(await provider.getShow("tvmaze:1")).toBeNull();
    expect(await provider.getMovie("tmdb:1")).toBeNull();
    expect(await provider.resolve("movie", {}, "Movie")).toBeNull();
    expect(await provider.getShow("tmdb:1")).toBeNull();
    expect(await provider.getEpisodes("bad")).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("falls back to title search for a missing canonical show ID", async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(reply(null, 404)).mockResolvedValueOnce(reply([{ show: mazeShow }]));
    expect(await createTvmaze(fetcher).resolve("show", { tvmaze: 999 }, "Example")).toBe("tvmaze:42");
  });
  it("retries 429 after Retry-After", async () => {
    vi.useFakeTimers();
    const fetcher = mockFetch().mockResolvedValueOnce(reply({}, 429, { "Retry-After": "2" })).mockResolvedValueOnce(reply(mazeShow));
    const result = createTvmaze(fetcher).getShow("tvmaze:42");
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ id: "tvmaze:42" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("bounds retry attempts and propagates errors", async () => {
    vi.useFakeTimers();
    const fetcher = mockFetch().mockResolvedValue(reply({}, 429));
    const result = expect(createTvmaze(fetcher).getShow("tvmaze:42")).rejects.toThrow("429");
    await vi.runAllTimersAsync();
    await result;
    expect(fetcher).toHaveBeenCalledTimes(4);
    await expect(createTvmaze(mockFetch().mockResolvedValue(reply({}, 500))).search("x")).rejects.toThrow("500");
  });
  it("throttles requests after the bucket is exhausted", async () => {
    vi.useFakeTimers();
    const fetcher = mockFetch().mockImplementation(async () => reply(mazeShow));
    const provider = createTvmaze(fetcher);
    const result = Promise.all(Array.from({ length: 21 }, () => provider.getShow("tvmaze:42")));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(20);
    await vi.advanceTimersByTimeAsync(500);
    await result;
    expect(fetcher).toHaveBeenCalledTimes(21);
  });
  it("filters schedule inclusively to the requested shows and dates", async () => {
    const fetcher = mockFetch().mockResolvedValue(reply([mazeEpisode, { ...mazeEpisode, number: 4, airdate: "2026-10-08" }, { ...mazeEpisode, number: 5, airdate: "2026-10-09" }]));
    expect(await createTvmaze(fetcher).schedule(["tvmaze:42", "tvmaze:42"], "2026-10-07", "2026-10-08")).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("TMDB", () => {
  it.each([{ movie_results: [] }, null])("returns null when IMDb lookup has no movie: %j", async (body) => {
    const fetcher = mockFetch().mockResolvedValue(reply(body, body === null ? 404 : 200));
    expect(await createTmdb("key", fetcher).getMovie("imdb:tt5")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("propagates IMDb lookup failures", async () => {
    const fetcher = mockFetch().mockResolvedValue(reply({}, 503));
    await expect(createTmdb("key", fetcher).getMovie("imdb:tt5")).rejects.toThrow("503");
  });
  it("maps movies, shows, episodes and image URLs", async () => {
    const fetcher = mockFetch()
      .mockResolvedValueOnce(reply({ id: 5, title: "Movie", release_date: "2001-02-03", poster_path: "/poster.jpg", overview: "<p>Story</p>", imdb_id: "tt5", runtime: 100 }))
      .mockResolvedValueOnce(reply({ id: 8, name: "Show", first_air_date: "2020-01-01", external_ids: { imdb_id: "tt8", tvdb_id: 9 } }))
      .mockResolvedValueOnce(reply({ id: 8, seasons: [{ season_number: 1 }] }))
      .mockResolvedValueOnce(reply({ episodes: [{ season_number: 1, episode_number: 2, air_date: "2026-10-07", overview: "<b>Next</b>" }] }));
    const provider = createTmdb("private-key", fetcher);
    expect(await provider.getMovie("tmdb:5")).toMatchObject({ id: "tmdb:5", kind: "movie", year: 2001, poster: "https://image.tmdb.org/t/p/w342/poster.jpg", summary: "Story", ids: { tmdb: 5, imdb: "tt5" } });
    expect(await provider.getShow("tmdb:8")).toMatchObject({ id: "tmdb:8", title: "Show", ids: { tmdb: 8, imdb: "tt8", tvdb: 9 } });
    expect(await provider.getEpisodes("tmdb:8")).toMatchObject([{ id: "tmdb:8:s1e2", summary: "Next" }]);
  });
  it("filters people from search and resolves IMDb with find", async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(reply({ results: [{ id: 1, media_type: "person" }, { id: 2, media_type: "movie", title: "Film" }, { id: 3, media_type: "tv", name: "TV" }] })).mockResolvedValueOnce(reply({ movie_results: [{ id: 2 }], tv_results: [] }));
    const provider = createTmdb("key", fetcher);
    expect(await provider.search("name")).toMatchObject([{ id: "tmdb:2", kind: "movie" }, { id: "tmdb:3", kind: "show" }]);
    expect(await provider.resolve("movie", { imdb: "tt2" }, "Film")).toBe("tmdb:2");
    expect(String(fetcher.mock.calls[1][0])).toContain("find/tt2?external_source=imdb_id");
  });
  it("falls back from external lookup to a matching title and year", async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(reply({ movie_results: [] })).mockResolvedValueOnce(reply({ results: [
      { id: 1, media_type: "movie", title: "Film", release_date: "1990-01-01" }, { id: 2, media_type: "movie", title: "Film", release_date: "2020-01-01" },
    ] }));
    expect(await createTmdb("key", fetcher).resolve("movie", { imdb: "tt2" }, "Film", 2020)).toBe("tmdb:2");
  });
  it("falls back from a missing canonical movie ID to search", async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(reply(null, 404)).mockResolvedValueOnce(reply({ results: [{ id: 2, media_type: "movie", title: "Film" }] }));
    expect(await createTmdb("key", fetcher).resolve("movie", { tmdb: 999 }, "Film")).toBe("tmdb:2");
  });
});

describe("client cache", () => {
  let database: EpisodicDB;
  beforeEach(() => { database = new EpisodicDB(`meta-test-${crypto.randomUUID()}`); __setDb(database); });
  afterEach(async () => { await database.delete(); });
  it("persists shows and serves a fresh cache across provider instances", async () => {
    const show = { id: "tvmaze:42", kind: "show", title: "Example", ids: { tvmaze: 42 }, fetchedAt: Date.now() };
    const fetcher = mockFetch().mockResolvedValue(reply(show)); vi.stubGlobal("fetch", fetcher);
    expect(await clientProvider().getShow(show.id)).toEqual(show);
    expect(await clientProvider().getShow(show.id)).toEqual(show);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await database.shows.get(show.id)).toEqual(show);
    const cache = await database.cache.toArray();
    expect(cache[0].expiresAt - Date.now()).toBeGreaterThan(86_390_000);
  });
  it.each(["show", "episodes", "movie", "search", "schedule"] as const)("expires %s with its configured TTL and stores entities", async (kind) => {
    const episode = { id: "tvmaze:42:s1e1", showId: "tvmaze:42", season: 1, number: 1 };
    const movie = { id: "tmdb:5", kind: "movie", title: "Film", ids: {}, fetchedAt: 1 };
    const show = { id: "tvmaze:42", kind: "show", title: "Show", ids: {}, fetchedAt: 1 };
    const value = kind === "show" ? show : kind === "movie" ? movie : kind === "search" ? [] : [episode];
    const fetcher = mockFetch().mockImplementation(async () => reply(value)); vi.stubGlobal("fetch", fetcher);
    const provider = clientProvider();
    const call = () => kind === "show" ? provider.getShow(show.id) : kind === "movie" ? provider.getMovie(movie.id) : kind === "episodes" ? provider.getEpisodes("tvmaze:42") : kind === "search" ? provider.search("query") : provider.schedule(["tvmaze:42"], "2026-10-01", "2026-10-31");
    await call(); await call();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [row] = await database.cache.toArray();
    const ttl = { show: 86400, movie: 86400, episodes: 43200, search: 3600, schedule: 10800 }[kind];
    expect(row.expiresAt - Date.now()).toBeGreaterThan(ttl * 1000 - 1000);
    expect(row.expiresAt - Date.now()).toBeLessThanOrEqual(ttl * 1000);
    await database.cache.update(row.key, { expiresAt: Date.now() - 1 });
    await call(); expect(fetcher).toHaveBeenCalledTimes(2);
    if (kind === "movie") expect(await database.movies.get(movie.id)).toEqual(movie);
    if (kind === "episodes" || kind === "schedule") expect(await database.episodes.get(episode.id)).toEqual(episode);
  });
  it("caches nulls, encodes resolve arguments, and never caches HTTP errors", async () => {
    const fetcher = mockFetch().mockImplementation(async () => reply(null)); vi.stubGlobal("fetch", fetcher);
    const provider = clientProvider();
    await provider.getShow("tvmaze:1"); await provider.getShow("tvmaze:1");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await provider.resolve("show", { imdb: "tt1", tvdb: 2 }, "A&B", 2020);
    expect(String(fetcher.mock.calls[1][0])).toContain("title=A%26B&year=2020&imdb=tt1&tvdb=2");
    fetcher.mockResolvedValueOnce(reply({}, 502));
    await expect(provider.search("broken")).rejects.toThrow("502");
    expect(await database.cache.get("meta:search?q=broken")).toBeUndefined();
  });
});

describe("proxy routes", () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv("TMDB_API_KEY", ""); });
  const context = (path: string[]) => ({ params: Promise.resolve({ path }) });
  it("serves IMDb movie IDs as canonical TMDB movies with full details", async () => {
    vi.stubEnv("TMDB_API_KEY", "test-private-key");
    const fetcher = mockFetch()
      .mockResolvedValueOnce(reply({ movie_results: [{ id: 5, title: "Film" }] }))
      .mockResolvedValueOnce(reply({ id: 5, title: "Film", imdb_id: "tt5", runtime: 100 }));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request("https://example.test/api/meta/movie/imdb:tt5"), context(["movie", "imdb:tt5"]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "tmdb:5", kind: "movie", runtime: 100, ids: { tmdb: 5, imdb: "tt5" } });
    expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(["/3/find/tt5", "/3/movie/5"]);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("external_source")).toBe("imdb_id");
  });
  it.each(["http", "network"])("preserves TVmaze search results on TMDB %s failure", async (failure) => {
    vi.stubEnv("TMDB_API_KEY", "test-private-key");
    const fetcher = mockFetch().mockImplementation(async (input) => {
      if (String(input).includes("tvmaze.com")) return reply([{ show: mazeShow }]);
      if (failure === "network") throw new Error("network failure");
      return reply({}, 503);
    });
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request("https://example.test/api/meta/search?q=Example"), context(["search"]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ id: "tvmaze:42", kind: "show" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(["", "test-private-key"])("restricts server show methods to TVmaze IDs with key %j", async (key) => {
    vi.stubEnv("TMDB_API_KEY", key);
    const fetcher = mockFetch().mockImplementation(async (input) =>
      String(input).includes("/episodes") ? reply([mazeEpisode]) : reply(mazeShow));
    vi.stubGlobal("fetch", fetcher);
    const { serverProvider } = await import("./index");
    const provider = serverProvider();
    expect(await provider.getShow("tmdb:8")).toBeNull();
    expect(await provider.getEpisodes("tmdb:8")).toEqual([]);
    expect(await provider.schedule(["tmdb:8"], "2026-10-07", "2026-10-07")).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await provider.getShow("tvmaze:42")).toMatchObject({ id: "tvmaze:42" });
    expect(await provider.getEpisodes("tvmaze:42")).toMatchObject([{ showId: "tvmaze:42" }]);
    expect(await provider.schedule(["tmdb:8", "tvmaze:42"], "2026-10-07", "2026-10-07")).toMatchObject([{ showId: "tvmaze:42" }]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.every(([url]) => new URL(String(url)).hostname === "api.tvmaze.com")).toBe(true);
  });
  it.each([
    ["show/tmdb:8", ["show", "tmdb:8"]],
    ["episodes/tmdb:8", ["episodes", "tmdb:8"]],
    ["schedule?ids=tvmaze:42,tmdb:8&from=2026-10-07&to=2026-10-07", ["schedule"]],
    ["show/imdb:tt5", ["show", "imdb:tt5"]],
    ["movie/tvmaze:42", ["movie", "tvmaze:42"]],
    ["movie/imdb:5", ["movie", "imdb:5"]],
    ["movie/imdb:tt", ["movie", "imdb:tt"]],
    ["movie/imdb:tt5x", ["movie", "imdb:tt5x"]],
  ])("rejects noncanonical IDs in %s with TMDB enabled", async (url, path) => {
    vi.stubEnv("TMDB_API_KEY", "test-private-key");
    const fetcher = mockFetch();
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request(`https://example.test/api/meta/${url}`), context(path as string[]));
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("serves show JSON with CDN cache headers", async () => {
    vi.stubGlobal("fetch", mockFetch().mockResolvedValue(reply(mazeShow)));
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request("https://example.test/api/meta/show/tvmaze:42"), context(["show", "tvmaze:42"]));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=86400, stale-while-revalidate=86400");
    expect(await response.json()).toMatchObject({ id: "tvmaze:42", summary: "Hello world." });
  });
  it.each([
    ["search?q=Example", ["search"], [{ show: mazeShow }], 3600],
    ["episodes/tvmaze:42", ["episodes", "tvmaze:42"], [mazeEpisode], 43200],
    ["resolve?kind=show&title=Example&imdb=tt123", ["resolve"], mazeShow, 86400],
    ["schedule?ids=tvmaze:42&from=2026-10-07&to=2026-10-07", ["schedule"], [mazeEpisode], 10800],
  ] as const)("supports %s", async (url, path, data, ttl) => {
    vi.stubGlobal("fetch", mockFetch().mockResolvedValue(reply(data)));
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request(`https://example.test/api/meta/${url}`), context([...path]));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain(`s-maxage=${ttl},`);
    expect(await response.json()).not.toBeNull();
  });
  it("merges TVmaze shows with TMDB movies and keeps keys out of responses", async () => {
    vi.stubEnv("TMDB_API_KEY", "test-private-key");
    const fetcher = mockFetch().mockImplementation(async (input) => String(input).includes("tvmaze.com") ? reply([{ show: mazeShow }]) : reply({ results: [{ id: 1, title: "Film", media_type: "movie" }, { id: 2, name: "Duplicate show", media_type: "tv" }] }));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request("https://example.test/api/meta/search?q=Example"), context(["search"]));
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject([{ id: "tvmaze:42" }, { id: "tmdb:1", kind: "movie" }]);
    expect(body).not.toContain("test-private-key");
  });
  it("serves movies only when configured and hides upstream errors", async () => {
    vi.stubEnv("TMDB_API_KEY", "test-private-key");
    const fetcher = mockFetch().mockResolvedValueOnce(reply({ id: 1, title: "Film" })).mockRejectedValueOnce(new Error("test-private-key"));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const request = new Request("https://example.test/api/meta/movie/tmdb:1");
    expect(await (await GET(request, context(["movie", "tmdb:1"]))).json()).toMatchObject({ id: "tmdb:1" });
    const failure = await GET(request, context(["movie", "tmdb:1"]));
    expect(failure.status).toBe(502);
    expect(failure.headers.get("Cache-Control")).toBe("no-store");
    expect(await failure.text()).not.toContain("test-private-key");
  });
  it("resolves TMDB-only show imports to TVmaze through external IDs", async () => {
    vi.stubEnv("TMDB_API_KEY", "test-private-key");
    const fetcher = mockFetch().mockResolvedValueOnce(reply({ id: 8, name: "Example", external_ids: { imdb_id: "tt123" } })).mockResolvedValueOnce(reply(mazeShow));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request("https://example.test/api/meta/resolve?kind=show&tmdb=8"), context(["resolve"]));
    expect(await response.json()).toBe("tvmaze:42");
    expect(String(fetcher.mock.calls[1][0])).toContain("lookup/shows?imdb=tt123");
  });
  it.each([
    ["search", ["search"]], ["show/bad", ["show", "bad"]],
    ["resolve?kind=other&title=Example", ["resolve"]],
    ["resolve?kind=show&tvdb=NaN", ["resolve"]],
    ["schedule?from=2026-02-30&to=2026-03-01", ["schedule"]],
    ["schedule?from=2026-10-08&to=2026-10-07", ["schedule"]],
  ])("rejects malformed request %s without upstream fetch", async (url, path) => {
    const fetcher = mockFetch(); vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../../app/api/meta/[...path]/route");
    const response = await GET(new Request(`https://example.test/api/meta/${url}`), context(path as string[]));
    expect(response.status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  });
});
