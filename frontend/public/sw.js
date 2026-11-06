/* Pantry Owl service worker.
 *
 * Strategy:
 *  - App shell and static assets: cached so the app installs and opens offline.
 *  - Page navigations: network first, fall back to cache, then /offline.
 *  - API calls (any cross-origin request) are NEVER cached, so item availability
 *    is always read fresh from the database.
 *
 * Bump CACHE_VERSION when changing this file's caching rules.
 */
const CACHE_VERSION = "v1";
const CACHE = `pantry-owl-${CACHE_VERSION}`;
const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pantry-owl-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never touch API / Supabase / other-origin traffic.
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/offline")))
    );
    return;
  }

  // Static assets: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
