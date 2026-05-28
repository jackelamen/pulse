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
  if (!vapidKey) return;

  try {
    const existing = await swReg.pushManager.getSubscription();
    const sub =
      existing ??
      (await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }));

    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: json.keys,
      }),
    });

    // Tell the SW to start its polling loop now that we have a subscription.
    swReg.active?.postMessage({ type: "PULSE_PING" });
  } catch (err) {
    console.warn("[pwa] push subscription failed:", err);
  }
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

        // If permission is already granted, register/refresh the push sub.
        if (Notification.permission === "granted") {
          await registerPushSubscription(reg);
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
    const result = await Notification.requestPermission();
    setNotifState(result);
    if (result === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await registerPushSubscription(reg);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showNotifNudge =
    notifState === "default" &&
    process.env.NODE_ENV === "production" &&
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  return (
    <>
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
