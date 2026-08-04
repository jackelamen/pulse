"use client";

import { useEffect, useState } from "react";
import { Bell, CloudOff, RefreshCcw, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { flushTaskQueue, queuedTaskCount } from "@/lib/offline/task-queue";

// ---------------------------------------------------------------------------
// Push subscription helpers
// ---------------------------------------------------------------------------

async function registerPushSubscription(swReg: ServiceWorkerRegistration) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[pwa] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — cannot subscribe.");
    return { ok: false, reason: "missing-vapid-key" as const };
  }

  const appServerKey = urlBase64ToUint8Array(vapidKey);

  try {
    // An existing subscription may be bound to a PREVIOUS VAPID key (e.g. after
    // a key rotation). Such a subscription can never receive our pushes, so
    // detect the mismatch and re-subscribe with the current key.
    const existing = await swReg.pushManager.getSubscription();
    let sub = existing;

    if (existing) {
      const boundKey = existing.options?.applicationServerKey;
      if (!boundKey || !buffersEqual(boundKey, appServerKey)) {
        console.info("[pwa] existing push subscription uses a stale VAPID key — resubscribing.");
        await existing.unsubscribe().catch(() => undefined);
        sub = null;
      }
    }

    if (!sub) {
      sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    }

    const json = sub.toJSON();
    // fetch() does NOT throw on 4xx/5xx — check explicitly or failures are silent.
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: json.keys,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[pwa] saving push subscription failed: HTTP ${res.status} ${res.statusText} ${detail}`
      );
      return { ok: false, reason: `http-${res.status}` as const };
    }

    console.info("[pwa] push subscription registered.");
    return { ok: true as const };
  } catch (err) {
    console.error("[pwa] push subscription failed:", err);
    return { ok: false, reason: "exception" as const };
  }
}

function buffersEqual(a: ArrayBuffer, b: ArrayBuffer) {
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false;
  return true;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  return bytes.buffer as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PwaRuntime() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // "prompt" means we should show the notification permission nudge.
  const [notifState, setNotifState] = useState<NotificationPermission | null>(null);
  // Surfaced so subscription failures aren't invisible on mobile (no console).
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(queuedTaskCount());

    // Notification permission state (may be undefined in non-secure contexts).
    if ("Notification" in window) {
      setNotifState(Notification.permission);
    }

    async function registerSW() {
      if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // Wait until the SW is actually active — pushManager.subscribe() can
        // fail if called against a registration that isn't ready yet.
        await navigator.serviceWorker.ready;

        // If permission is already granted, register/refresh the push sub.
        if (Notification.permission === "granted") {
          const result = await registerPushSubscription(reg);
          if (result && !result.ok) setPushError(result.reason);
        }
      } catch {
        // SW registration failures are non-fatal.
      }
    }

    async function sync() {
      setOnline(navigator.onLine);
      setQueued(queuedTaskCount());
      if (!navigator.onLine || queuedTaskCount() === 0) return;
      setSyncing(true);
      try {
        await flushTaskQueue(qc);
      } finally {
        setQueued(queuedTaskCount());
        setSyncing(false);
      }
    }

    function refreshQueue() {
      setQueued(queuedTaskCount());
    }

    registerSW();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("pulse-offline-queue-changed", refreshQueue);
    sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("pulse-offline-queue-changed", refreshQueue);
    };
  }, [qc]);

  // ── Notification permission request ──────────────────────────────────────

  async function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    setPushError(null);
    const result = await Notification.requestPermission();
    setNotifState(result);
    if (result === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await registerPushSubscription(reg);
      if (sub && !sub.ok) setPushError(sub.reason);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showNotifNudge =
    notifState === "default" &&
    process.env.NODE_ENV === "production" &&
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  return (
    <>
      {/* Push subscription failure — visible so mobile failures aren't silent */}
      {pushError && (
        <div className="fixed inset-x-3 bottom-32 z-50 mx-auto flex max-w-sm items-start gap-2 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-xs shadow-lg md:bottom-16">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">
            Reminders could not be enabled ({pushError}).
            {pushError === "http-401" && " You may need to sign in again."}
          </span>
          <button
            onClick={() => setPushError(null)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Offline / sync banner */}
      {(!online || queued > 0) && (
        <div className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg md:bottom-4">
          {online ? (
            <RefreshCcw
              className={`h-3.5 w-3.5 text-muted-foreground ${syncing ? "animate-spin" : ""}`}
            />
          ) : (
            <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1">
            {online
              ? `${queued} queued task${queued === 1 ? "" : "s"} syncing`
              : "Offline. New tasks will sync later."}
          </span>
        </div>
      )}

      {/* One-time notification permission nudge */}
      {showNotifNudge && (
        <div className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-sm items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-xs shadow-lg md:bottom-4">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 space-y-2">
            <p className="font-medium text-foreground">Enable reminders?</p>
            <p className="text-muted-foreground">
              Allow notifications so Pulse can alert you when a task reminder fires — even when the app isn&apos;t open.
            </p>
            <div className="flex gap-2">
              <button
                onClick={requestNotificationPermission}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
              >
                Enable
              </button>
              <button
                onClick={() => setNotifState("denied")}
                className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={() => setNotifState("denied")}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
