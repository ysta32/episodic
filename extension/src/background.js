/** @typedef {import('./detectors.js').Scrobble} Scrobble */
/** @typedef {Scrobble & {key: string, queuedAt: number, openedAt?: number}} Entry */
const defaults = { enabled: true, appUrl: "https://episodic-app.vercel.app", pending: [], recent: [] };
let work = Promise.resolve();

/** @param {unknown} value @returns {value is Scrobble} */
function validScrobble(value) {
  if (!value || typeof value !== "object") return false;
  const item = /** @type {Record<string, unknown>} */ (value);
  return (item.kind === "movie" || item.kind === "episode") &&
    typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 500 &&
    typeof item.progress === "number" && Number.isFinite(item.progress) && item.progress >= 0.9 && item.progress <= 1 &&
    (item.kind === "movie" || (typeof item.season === "number" && Number.isSafeInteger(item.season) && item.season >= 0 &&
      typeof item.episode === "number" && Number.isSafeInteger(item.episode) && item.episode >= 1));
}

/** @param {unknown} value */
function appOrigin(value) {
  if (typeof value !== "string") throw new Error("Enter an HTTPS app origin.");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    Number(url.port) >= 4700 && Number(url.port) <= 4799;
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use an HTTPS origin, or http://localhost:4700–4799, without a path.");
  }
  return url.origin;
}

async function sync() {
  const state = await chrome.storage.local.get(defaults);
  if (!state.enabled) return { ok: true, opened: 0 };
  const origin = appOrigin(state.appUrl);
  /** @type {Entry[]} */
  const pending = state.pending;
  /** @type {Entry[]} */
  let recent = state.recent;
  let opened = 0;
  while (pending.length) {
    const entry = pending[0];
    const url = new URL("/app/scrobble", origin);
    url.searchParams.set("title", entry.title);
    url.searchParams.set("kind", entry.kind);
    url.searchParams.set("progress", String(entry.progress));
    if (entry.kind === "episode") {
      url.searchParams.set("season", String(entry.season));
      url.searchParams.set("episode", String(entry.episode));
    }
    await chrome.tabs.create({ url: url.href, active: false });
    pending.shift();
    recent = [{ ...entry, openedAt: Date.now() }, ...recent.filter((item) => item.key !== entry.key)].slice(0, 100);
    await chrome.storage.local.set({ pending, recent });
    opened += 1;
  }
  return { ok: true, opened };
}

/** @param {Scrobble} item */
async function enqueue(item) {
  const state = await chrome.storage.local.get(defaults);
  if (!state.enabled) return { ok: true };
  const title = item.title.trim();
  const key = JSON.stringify([item.kind, title.toLowerCase(), item.season ?? null, item.episode ?? null]);
  /** @type {Entry[]} */
  const pending = state.pending;
  /** @type {Entry[]} */
  const recent = state.recent;
  if (pending.some((entry) => entry.key === key) || recent.some((entry) => entry.key === key)) return { ok: true };
  if (pending.length >= 500) throw new Error("Queue is full. Sync pending scrobbles first.");
  const entry = { key, title, kind: item.kind, progress: item.progress, queuedAt: Date.now(),
    ...(item.kind === "episode" ? { season: item.season, episode: item.episode } : {}) };
  await chrome.storage.local.set({ pending: [...pending, entry] });
  return sync();
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== "object") return false;
  const popup = sender.url === chrome.runtime.getURL("src/popup.html");
  let streaming = false;
  try {
    const url = new URL(sender.url || "");
    streaming = url.protocol === "https:" && /(^|\.)(netflix\.com|hulu\.com)$|^(play\.)?max\.com$/.test(url.hostname);
  } catch { /* Messages without a URL are not playback reports. */ }
  if (!popup && !(streaming && message.type === "scrobble")) return false;
  work = work.then(async () => {
    if (message.type === "scrobble" && streaming) {
      if (!validScrobble(message.scrobble)) throw new Error("Invalid scrobble.");
      return enqueue(message.scrobble);
    }
    if (message.type === "sync" && popup) return sync();
    if (message.type === "settings" && popup) {
      if (typeof message.enabled !== "boolean") throw new Error("Invalid enabled setting.");
      await chrome.storage.local.set({ enabled: message.enabled, appUrl: appOrigin(message.appUrl) });
      return { ok: true };
    }
    throw new Error("Unknown request.");
  }).then(respond, (error) => respond({ ok: false, error: error instanceof Error ? error.message : "Scrobbling failed." }));
  return true;
});
