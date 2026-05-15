"use client";

import { useEffect } from "react";

export default function RootPage() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="pulse-pane w-full max-w-sm p-8 text-center">
        <div className="mx-auto h-10 w-10 rounded-xl bg-primary" />
        <h1 className="mt-5 font-display text-xl font-semibold text-foreground">Opening Pulse</h1>
        <p className="mt-2 text-sm text-muted-foreground">Taking you to sign in...</p>
      </div>
    </main>
  );
}
