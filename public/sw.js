/**
 * Minimal Summit precache service worker (spec 005 Constitution V, research D-OFFLINE). Caches
 * the app shell so a cold start with NO connectivity still opens the tool — everything after
 * that (climb generation, stage narrative, PDF rendering) already runs from the bundled content
 * modules with zero network. Deliberately hand-written and tiny: one precache list, one
 * cache-first-with-network-fallback strategy. No push, no background sync, no third-party
 * toolchain — a full PWA framework would be more machinery than a single precache list needs.
 */

const CACHE_NAME = "jaxtina-summit-shell-v1";
const SHELL_PATH = "/lo-trinh-ielts";

const PRECACHE_URLS = [
  SHELL_PATH,
  "/ielts/jaxtina-logo.png",
  "/brand/mascot-climber.png",
  "/brand/tagline-lockup.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Cache-first for the shell + its static assets; network passthrough for everything else
 *  (API/server-action POSTs, data fetches) — this worker never intercepts the send step. */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isShellAsset = PRECACHE_URLS.some((p) => url.pathname === p);
  if (!isShellAsset && url.pathname !== SHELL_PATH) return;

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(SHELL_PATH)),
    ),
  );
});
