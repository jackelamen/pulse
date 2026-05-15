/**
 * Pulse service worker.
 *
 * Scope: keep this minimal. Caching arbitrary navigations against a Next App
 * Router app breaks subsequent client-side navigations once offline, because
 * those navigations request RSC payloads, not full HTML. We deliberately do
 * NOT cache navigation responses. The only navigation behavior is: if a
 * full-document fetch fails because the network is down, fall back to
 * /offline.html so the user gets a real page instead of a browser error.
 *
 * For static assets (Next chunks, icons) we use cache-first since they are
 * versioned by hash and safe to re-use indefinitely.
 */

const CACHE_NAME = "pulse-shell-v2";
const SHELL_URLS = ["/offline.html", "/icons/pulse.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-only, with offline.html as the fallback. Do NOT
  // populate the cache with HTML responses — see the file header for why.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const fallback = await caches.match("/offline.html");
        return (
          fallback ||
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      })
    );
    return;
  }

  // Versioned static assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Only cache successful, basic (same-origin) responses.
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
