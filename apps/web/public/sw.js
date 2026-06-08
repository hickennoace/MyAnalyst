/* MyAnalyst service worker — offline support for a privacy-first, client-side app.
 *
 * Strategy:
 *  - Navigations: network-first, falling back to the cached app shell so the app opens offline.
 *  - Static assets (Next chunks, fonts, icons): stale-while-revalidate — instant, refreshed in the bg.
 *  - Never touch /api/* (the optional LLM route) or non-GET / cross-origin requests.
 * Because the entire analysis engine runs in the browser, a cached build analyzes data with no network.
 */
const VERSION = "myanalyst-v1";
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PAGES);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(req)) || (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: serve from cache, revalidate in the background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            caches.open(ASSETS).then((c) => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })()
  );
});
