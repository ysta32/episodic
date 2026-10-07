// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { detectNetflix, detectHulu, detectMax } from "../src/detectors.js";

const playback = { currentTime: 95, duration: 100 };

function documentWith(html: string, title = "") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.title = title;
  return doc;
}

describe("player metadata", () => {
  it("reads Netflix's show heading and episode span", () => {
    const doc = documentWith('<div data-uia="video-title"><h4>Dark</h4><span>S2:E5</span><span>Lost and Found</span></div>');
    expect(detectNetflix(doc, playback)).toEqual({ kind: "episode", title: "Dark", season: 2, episode: 5, progress: 0.95 });
  });

  it("reads Hulu title and subtitle", () => {
    const doc = documentWith('<div class="PlayerMetadata__title">The Bear</div><div class="PlayerMetadata__subtitle">Season 2, Episode 5</div>');
    expect(detectHulu(doc, playback)).toEqual({ kind: "episode", title: "The Bear", season: 2, episode: 5, progress: 0.95 });
  });

  it("reads Max player metadata", () => {
    const doc = documentWith('<div data-testid="player-title">The Last of Us</div><div data-testid="player-subtitle">S1 E3 · Long, Long Time</div>');
    expect(detectMax(doc, playback)).toEqual({ kind: "episode", title: "The Last of Us", season: 1, episode: 3, progress: 0.95 });
  });

  it.each([detectHulu, detectMax])("reads Open Graph metadata for movies", (detect) => {
    const doc = documentWith('<meta property="og:title" content="Dune &amp; More | Max">');
    expect(detect(doc, playback)).toEqual({ kind: "movie", title: "Dune & More", progress: 0.95 });
  });

  it("prioritizes Netflix's player over the browser title", () => {
    const doc = documentWith('<div data-uia="video-title"><h4>Current</h4><span>S2:E5</span></div>', "Stale: S1 E1 | Netflix");
    expect(detectNetflix(doc, playback)).toMatchObject({ title: "Current", season: 2, episode: 5 });
  });
});

describe.each([
  ["Netflix", detectNetflix], ["Hulu", detectHulu], ["Max", detectMax],
] as const)("%s document fallback and playback", (service, detect) => {
  it("parses episode document titles", () => {
    expect(detect(documentWith("", `Show: S1 E3 | ${service}`), playback)).toEqual({
      kind: "episode", title: "Show", season: 1, episode: 3, progress: 0.95,
    });
  });
  it("parses movie document titles", () => {
    expect(detect(documentWith("", `Watch Arrival - ${service}`), playback)).toEqual({ kind: "movie", title: "Arrival", progress: 0.95 });
  });
  it("retains punctuation and Unicode in titles", () => {
    expect(detect(documentWith("", "Amélie: A Story & More"), playback)?.title).toBe("Amélie: A Story & More");
  });
  it.each([0, -1, Infinity, NaN])("ignores invalid duration %s", (duration) => {
    expect(detect(documentWith("", "Movie"), { ...playback, duration })).toBeNull();
  });
  it("ignores missing video and nonfinite playback times", () => {
    const doc = documentWith("", "Movie");
    expect(detect(doc, null)).toBeNull();
    expect(detect(doc, { ...playback, currentTime: NaN })).toBeNull();
    expect(detect(doc, { ...playback, currentTime: Infinity })).toBeNull();
  });
  it("clamps progress to the contract range", () => {
    const doc = documentWith("", "Movie");
    expect(detect(doc, { duration: 100, currentTime: -2 })?.progress).toBe(0);
    expect(detect(doc, { duration: 100, currentTime: 102 })?.progress).toBe(1);
  });
  it("returns fractional progress before the dispatch threshold", () => {
    expect(detect(documentWith("", "Movie"), { duration: 100, currentTime: 50 })?.progress).toBe(0.5);
  });
  it("ignores missing titles and service landing titles", () => {
    expect(detect(documentWith(""), playback)).toBeNull();
    expect(detect(documentWith("", service), playback)).toBeNull();
  });
  it.each(["Show: Season 2", "Show: S1 E", "Show: S1 E0"])("does not misclassify incomplete episodes: %s", (title) => {
    expect(detect(documentWith("", title), playback)).toBeNull();
  });
  it("accepts season zero specials", () => {
    expect(detect(documentWith("", "Show: S0 E1"), playback)).toMatchObject({ kind: "episode", season: 0, episode: 1 });
  });
});

describe("manifest", () => {
  it("is valid MV3 JSON with only the permitted hosts and permission", () => {
    const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual([
      "https://*.netflix.com/*", "https://*.hulu.com/*", "https://max.com/*", "https://play.max.com/*",
    ]);
    expect(manifest.content_scripts[0].matches).toEqual(manifest.host_permissions);
    expect(manifest.web_accessible_resources[0].matches).toEqual(manifest.host_permissions);
    expect(manifest.background).toEqual({ service_worker: "src/background.js", type: "module" });
    expect(manifest.action.default_popup).toBe("src/popup.html");
    expect(manifest.web_accessible_resources[0].resources).toEqual(["src/detectors.js"]);
  });
});

type Sender = { id: string; url: string };
type Response = { ok: boolean; error?: string; opened?: number };
type Listener = (message: unknown, sender: Sender, respond: (response: Response) => void) => boolean;
type StoredEntry = { title: string; key: string; openedAt?: number };

function background(initial: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = structuredClone(initial);
  const tabs: { url: string; active: boolean }[] = [];
  let listener: Listener | undefined;
  let failTabs = false;
  const chrome = {
    runtime: {
      id: "extension-id",
      getURL: (path: string) => `chrome-extension://extension-id/${path}`,
      onMessage: { addListener: (handler: Listener) => { listener = handler; } },
    },
    storage: { local: {
      get: async (defaults: Record<string, unknown>) => structuredClone({ ...defaults, ...state }),
      set: async (values: Record<string, unknown>) => { Object.assign(state, structuredClone(values)); },
    } },
    tabs: { create: async (tab: { url: string; active: boolean }) => {
      if (failTabs) throw new Error("Tab creation failed");
      tabs.push(tab);
    } },
  };
  runInNewContext(readFileSync("extension/src/background.js", "utf8"), { chrome, URL });
  return {
    state, tabs,
    failTabs: (fail: boolean) => { failTabs = fail; },
    send: (message: unknown, url = "https://www.netflix.com/watch/123", id = "extension-id") =>
      new Promise<Response>((resolve, reject) => {
        if (!listener?.(message, { id, url }, resolve)) reject(new Error("Ignored sender"));
      }),
  };
}

const movie = { kind: "movie", title: "A & B? / Film", progress: 0.9 };
const popup = "chrome-extension://extension-id/src/popup.html";

describe("background queue and receiver dispatch", () => {
  it("opens an inactive receiver with encoded movie query parameters", async () => {
    const worker = background();
    expect(await worker.send({ type: "scrobble", scrobble: movie })).toMatchObject({ ok: true });
    expect(worker.tabs).toHaveLength(1);
    expect(worker.tabs[0].active).toBe(false);
    const url = new URL(worker.tabs[0].url);
    expect(url.origin + url.pathname).toBe("https://episodic-app.vercel.app/app/scrobble");
    expect(Object.fromEntries(url.searchParams)).toEqual({ title: movie.title, kind: "movie", progress: "0.9" });
    expect(worker.state.pending).toEqual([]);
    expect(worker.state.recent).toHaveLength(1);
  });
  it("serializes simultaneous reports and suppresses duplicate episodes", async () => {
    const worker = background();
    const message = { type: "scrobble", scrobble: { kind: "episode", title: "Show", season: 2, episode: 5, progress: 0.95 } };
    const responses = await Promise.all([worker.send(message), worker.send(message)]);
    expect(responses.every((response) => response.ok)).toBe(true);
    expect(worker.tabs).toHaveLength(1);
    expect(new URL(worker.tabs[0].url).searchParams.get("season")).toBe("2");
    expect(new URL(worker.tabs[0].url).searchParams.get("episode")).toBe("5");
    await worker.send({ ...message, scrobble: { ...message.scrobble, episode: 6 } });
    expect(worker.tabs).toHaveLength(2);
  });
  it("retains failed dispatches across worker restart and retries with sync now", async () => {
    const worker = background();
    worker.failTabs(true);
    expect((await worker.send({ type: "scrobble", scrobble: movie })).ok).toBe(false);
    expect(worker.state.pending).toHaveLength(1);
    const restarted = background(worker.state);
    expect(await restarted.send({ type: "sync" }, popup)).toEqual({ ok: true, opened: 1 });
    expect(restarted.state.pending).toEqual([]);
    expect((restarted.state.recent as StoredEntry[])[0].openedAt).toEqual(expect.any(Number));
    await restarted.send({ type: "scrobble", scrobble: movie });
    expect(restarted.tabs).toHaveLength(1);
  });
  it("honors the off toggle for collection and pending dispatch", async () => {
    const worker = background({ enabled: false });
    await worker.send({ type: "scrobble", scrobble: movie });
    expect(await worker.send({ type: "sync" }, popup)).toEqual({ ok: true, opened: 0 });
    expect(worker.tabs).toEqual([]);
    expect(worker.state.pending).toBeUndefined();
  });
  it("uses the configured app origin", async () => {
    const worker = background();
    expect(await worker.send({ type: "settings", enabled: true, appUrl: "https://example.com/" }, popup)).toEqual({ ok: true });
    await worker.send({ type: "scrobble", scrobble: movie });
    expect(new URL(worker.tabs[0].url).origin).toBe("https://example.com");
  });
  it.each(["javascript:alert(1)", "http://example.com", "https://user:password@example.com", "https://example.com/path", "http://localhost:3000"])("rejects unsafe/invalid app origin %s", async (appUrl) => {
    const worker = background();
    expect((await worker.send({ type: "settings", enabled: true, appUrl }, popup)).ok).toBe(false);
    expect(worker.state.appUrl).toBeUndefined();
  });
  it("allows local development in the assigned port range", async () => {
    const worker = background();
    expect((await worker.send({ type: "settings", enabled: true, appUrl: "http://localhost:4700" }, popup)).ok).toBe(true);
  });
  it.each([
    { ...movie, progress: 0.89 }, { ...movie, progress: Infinity }, { ...movie, title: " " },
    { ...movie, kind: "episode" }, { ...movie, kind: "show" },
  ])("rejects invalid or below-threshold reports", async (scrobble) => {
    const worker = background();
    expect((await worker.send({ type: "scrobble", scrobble })).ok).toBe(false);
    expect(worker.tabs).toHaveLength(0);
  });
  it.each(["https://netflix.com.evil.test/watch", "https://evil.test", "http://www.netflix.com/watch"])("ignores playback from %s", async (url) => {
    const worker = background();
    await expect(worker.send({ type: "scrobble", scrobble: movie }, url)).rejects.toThrow("Ignored sender");
  });
  it("rejects streaming pages changing settings and foreign extension messages", async () => {
    const worker = background();
    await expect(worker.send({ type: "settings", enabled: false, appUrl: "https://example.com" })).rejects.toThrow("Ignored sender");
    await expect(worker.send({ type: "sync" }, popup, "another-extension")).rejects.toThrow("Ignored sender");
  });
});
