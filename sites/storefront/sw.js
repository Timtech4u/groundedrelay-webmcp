// Cache the shell so the app opens offline once installed. Tool calls are never
// cached — they cross an origin boundary and must always hit the provider.
const CACHE = "groundedrelay-v11";
const SHELL = [
  "./",
  "./store.css",
  "./store.js",
  "./trace.js",
  "./provider-origin.js",
  "./provider-mode.js",
  "./approval-view.js",
  "./checkout-lifecycle.js",
  "./serial-queue.js",
  "./icon.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network-first: a cached shell must never mask a newer deploy. The cache is
// the offline fallback, not the source of truth.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;      // never touch the provider
  if (url.pathname === "/_dev/reload") return;    // local dev stream; never cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // A save can momentarily race a reload. Never replace a good offline
        // shell with a transient 404/500, and never cache non-idempotent work.
        if (e.request.method === "GET" && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit ?? Promise.reject())));
});
