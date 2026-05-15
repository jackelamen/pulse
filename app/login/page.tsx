"use client";

import { Suspense, useState, type FormEvent } from "react";
import type { Route } from "next";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "signin" | "signup";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background p-6">
          <div className="pulse-pane w-full max-w-sm p-8 text-sm text-muted-foreground">
            Loading sign in...
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/today";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "ok" | "err"; msg?: string }>({
    kind: "idle",
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) {
          setStatus({ kind: "err", msg: error.message });
        } else if (data.session) {
          router.push(next as Route);
          router.refresh();
        } else {
          setStatus({ kind: "ok", msg: "Account created. Check your email to confirm it, then sign in." });
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus({ kind: "err", msg: error.message });
      } else {
        router.push(next as Route);
        router.refresh();
      }
    } catch (error) {
      setStatus({
        kind: "err",
        msg: error instanceof Error ? error.message : "Could not sign in. Check the deployment settings.",
      });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="pulse-pane w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <div>
            <div className="font-display text-lg font-semibold leading-tight">Pulse</div>
            <div className="text-xs text-muted-foreground">EDGEx Tasks</div>
          </div>
        </div>

        <h1 className="font-display text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in with email and password." : "Create your Pulse account."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          <Button type="submit" className="w-full" disabled={status.kind === "loading"}>
            {status.kind === "loading"
              ? "Working..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        {status.kind === "ok" && (
          <p className="mt-3 text-sm text-emerald-600">{status.msg}</p>
        )}
        {status.kind === "err" && (
          <p className="mt-3 text-sm text-destructive">{status.msg}</p>
        )}

        <button
          type="button"
          onClick={() => {
            setStatus({ kind: "idle" });
            setMode((m) => (m === "signin" ? "signup" : "signin"));
          }}
          className="mt-5 text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
