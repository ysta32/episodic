const CACHE_PREFIX = "episodic-";
const VERSION = "v1";
const PAGE_CACHE = `${CACHE_PREFIX}${VERSION}-pages`;
const STATIC_CACHE = `${CACHE_PREFIX}${VERSION}-static`;
const META_CACHE = `${CACHE_PREFIX}${VERSION}-meta`;
const CURRENT_CACHES = new Set([PAGE_CACHE, STATIC_CACHE, META_CACHE]);
const ICONS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];
const META_LIMIT = 300;
let metadataQueue = Promise.resolve();

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .open(PAGE_CACHE)
        .then((cache) => cache.addAll(["/app", "/offline"])),
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(ICONS)),
    ]),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(name),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

async function store(cacheName, request, response) {
  if (!response.ok || response.status === 206 || response.redirected) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    // A full or unavailable cache must not prevent an online response.
  }
}

async function match(cacheName, request) {
  try {
    return await (await caches.open(cacheName)).match(request);
  } catch {
    return undefined;
  }
}

async function navigation(event) {
  try {
    const response = await fetch(event.request);
    if (response.status >= 500) throw new Error("Navigation unavailable");
    event.waitUntil(store(PAGE_CACHE, event.request, response.clone()));
    return response;
  } catch {
    return (
      (await match(PAGE_CACHE, event.request)) ||
      (await match(PAGE_CACHE, "/offline")) ||
      new Response("You are offline. Reconnect and try again.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function staticAsset(event) {
  const cached = await match(STATIC_CACHE, event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  event.waitUntil(store(STATIC_CACHE, event.request, response.clone()));
  return response;
}

function withMetadataCache(operation) {
  const result = metadataQueue.then(async () =>
    operation(await caches.open(META_CACHE)),
  );
  metadataQueue = result.catch(() => undefined);
  return result;
}

async function metadata(event) {
  // Serialize reads, touches, and writes so concurrent requests preserve the LRU bound.
  const cached = await withMetadataCache(async (cache) => {
    const response = await cache.match(event.request);
    if (response) {
      await cache.delete(event.request);
      await cache.put(event.request, response.clone());
    }
    return response;
  }).catch(() => undefined);

  const fresh = fetch(event.request).then((response) => {
    if (response.ok && response.status !== 206 && !response.redirected) {
      const copy = response.clone();
      event.waitUntil(
        withMetadataCache(async (cache) => {
          await cache.delete(event.request);
          await cache.put(event.request, copy);
          const keys = await cache.keys();
          for (const key of keys.slice(
            0,
            Math.max(0, keys.length - META_LIMIT),
          )) {
            await cache.delete(key);
          }
        }).catch(() => undefined),
      );
    }
    return response;
  });
  event.waitUntil(
    fresh.then(
      () => undefined,
      () => undefined,
    ),
  );
  return cached || fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/meta/")) {
    event.respondWith(metadata(event));
  } else if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return;
  } else if (request.mode === "navigate") {
    event.respondWith(navigation(event));
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    ICONS.includes(url.pathname)
  ) {
    event.respondWith(staticAsset(event));
  }
});
