/**
 * Pulse service worker.
 *
 * Responsibilities:
 *  1. Offline shell — cache static assets; show /offline.html when navigating
 *     without a network connection.
 *  2. Push notifications — listen for 'push' events sent by the server and
 *     show a notification via self.registration.showNotification().
 *  3. Reminder polling — every ~60 s, call POST /api/push/notify (which runs
 *     server-side with the user's auth cookie). The server finds tasks whose
 *     reminder_at is within the next 2 minutes, fires Web Push to every
 *     registered subscription for that user, and clears reminder_at.
 *     This means reminders fire even when the app tab isn't active, as long
 *     as the PWA's service worker is alive.
 *
 * Caching strategy: deliberately minimal. We do NOT cache navigation
 * responses (RSC payloads break if served from cache). Only versioned static
 * assets and the offline fallback are cached.
 */

const CACHE_NAME = "pulse-shell-v3";
const SHELL_URLS = ["/offline.html", "/icons/pulse.svg"];

// ── Lifecycle ────────────────────────────────────────────────────────────────

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
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => {
        self.clients.claim();
        // Start the reminder polling loop once the SW is active.
        scheduleReminderPoll();
      })
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
      icon: "/icons/pulse.svg",
      badge: "/icons/pulse.svg",
      tag: taskId ? `pulse-task-${taskId}` : "pulse-reminder",
      renotify: true,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/today";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing Pulse window if one is open.
        for (const client of clients) {
          if (new URL(client.url).origin === self.location.origin) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ── Reminder polling ─────────────────────────────────────────────────────────
//
// We use setInterval inside the SW as a lightweight alternative to the
// Background Periodic Sync API (which requires a site engagement score and
// isn't universally available). The interval runs while the SW is alive —
// which, for an installed PWA, is typically the whole day.
//
// The server-side POST /api/push/notify does the heavy lifting: it queries
// for tasks with reminder_at <= now + 2 min, sends Web Push, then clears
// reminder_at so the same task never fires twice.

let _pollInterval = null;

function scheduleReminderPoll() {
  if (_pollInterval) return; // Already running
  // Fire once immediately (in case the SW just woke up and there are overdue
  // reminders), then every 60 seconds.
  pollReminders();
  _pollInterval = setInterval(pollReminders, 60 * 1000);
}

async function pollReminders() {
  try {
    // credentials: "include" sends the auth cookie so the server can
    // identify the user without a separate auth header.
    await fetch("/api/push/notify", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Network offline or server error — silently ignore, will retry next tick.
  }
}

// Re-start the polling loop when the SW is resumed after being idle.
self.addEventListener("message", (event) => {
  if (event.data?.type === "PULSE_PING") {
    scheduleReminderPoll();
  }
});
