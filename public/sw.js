/**
 * Pulse service worker.
 *
 * Responsibilities:
 *  1. Offline shell — cache static assets; show /offline.html when navigating
 *     without a network connection.
 *  2. Push notifications — listen for 'push' events sent by the server and
 *     show a notification via self.registration.showNotification().
 *  3. (Reminders are NOT triggered here.) A server-side pg_cron job invokes
 *     the `send-reminders` Edge Function every minute, which sends Web Push for
 *     any due reminder across all users. That works even when Pulse is closed
 *     and the service worker is dead — which is exactly why the old in-SW
 *     setInterval poller was removed. This worker only RECEIVES the resulting
 *     push (see the 'push' handler below) and shows the notification.
 *
 * Caching strategy: deliberately minimal. We do NOT cache navigation
 * responses (RSC payloads break if served from cache). Only versioned static
 * assets and the offline fallback are cached.
 */

const CACHE_NAME = "pulse-shell-v8";
const SHELL_URLS = [
  "/offline.html",
  "/icons/pulse.svg",
  "/icons/pulse-192.png",
  "/icons/pulse-badge.png",
];

// ── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            fetch(url)
              .then((response) => {
                if (!response.ok) return undefined;
                return cache.put(url, response);
              })
              .catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch — offline shell ────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

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

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
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

// ── Push events ──────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Pulse", body: event.data.text(), url: "/today" };
  }

  const { title = "Pulse", body = "You have a reminder.", url = "/today", taskId } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // Chrome on Android does NOT render SVG notification icons — must be PNG.
      icon: "/icons/pulse-192.png",
      // The badge (small status-bar glyph) is drawn from the ALPHA CHANNEL ONLY
      // and tinted white by Android. A full-bleed icon therefore shows up as a
      // solid white box; this asset is a transparent bolt silhouette instead.
      badge: "/icons/pulse-badge.png",
      tag: taskId ? `pulse-task-${taskId}` : "pulse-reminder",
      renotify: true,
      // Strong, attention-grabbing haptic pattern: long buzz, gap, long buzz,
      // gap, long buzz (values are milliseconds, alternating vibrate/pause).
      // The Web Vibration API controls timing/rhythm only — not raw motor
      // intensity, which is governed by the OS and device settings.
      vibrate: [400, 150, 400, 150, 400],
      requireInteraction: true,
      data: { url, taskId },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/today";
  const targetHref = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const sameOrigin = clients.filter(
        (client) => new URL(client.url).origin === self.location.origin
      );

      // A window already sitting on the target URL only needs focus.
      const exact = sameOrigin.find((client) => client.url === targetHref);
      if (exact) return exact.focus();

      // Otherwise steer an existing Pulse window to the target. `navigate()`
      // REJECTS for a client this service worker doesn't control - which
      // `includeUncontrolled: true` deliberately lets through - so an
      // unawaited call would silently leave the window on whatever page it
      // was already showing, which is exactly what a click then looks like:
      // the app comes to the front on a stale page and nothing loads.
      for (const client of sameOrigin) {
        try {
          const navigated = await client.navigate(targetUrl);
          await (navigated ?? client).focus();
          return;
        } catch {
          // Uncontrolled or otherwise un-navigable - try the next window,
          // and fall through to openWindow if none of them work.
        }
      }

      return self.clients.openWindow(targetUrl);
    })()
  );
});
