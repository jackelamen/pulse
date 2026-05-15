"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { flushTaskQueue, queuedTaskCount } from "@/lib/offline/task-queue";

export function PwaRuntime() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(queuedTaskCount());

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    async function sync() {
      setOnline(navigator.onLine);
      setQueued(queuedTaskCount());
      if (!navigator.onLine || queuedTaskCount() === 0) return;
      setSyncing(true);
      try {
        // Passing the QueryClient lets the queue invalidate task queries
        // after a successful flush so optimistic offline rows get replaced
        // by real server rows.
        await flushTaskQueue(qc);
      } finally {
        setQueued(queuedTaskCount());
        setSyncing(false);
      }
    }

    function refreshQueue() {
      setQueued(queuedTaskCount());
    }

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

  if (online && queued === 0) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg md:bottom-4">
      {online ? (
        <RefreshCcw className={`h-3.5 w-3.5 text-muted-foreground ${syncing ? "animate-spin" : ""}`} />
      ) : (
        <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        {online ? `${queued} queued task${queued === 1 ? "" : "s"} syncing` : "Offline. New tasks will sync later."}
      </span>
    </div>
  );
}
