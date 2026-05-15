"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const next = params.get("next") || "/today";
  const errorMessage = params.get("err");
  const okMessage = params.get("ok");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

        <form action="/auth/password" method="post" className="mt-6 space-y-3">
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="next" value={next} />
          <Input
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            name="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          <Button type="submit" className="w-full">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {okMessage && (
          <p className="mt-3 text-sm text-emerald-600">{okMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
        )}

        <button
          type="button"
          onClick={() => {
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
