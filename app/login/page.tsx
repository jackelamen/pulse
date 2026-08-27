"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { PulseMark } from "@/components/app-shell/pulse-mark";

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
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (result.error) {
        setMessage({ type: "error", text: result.error.message });
        return;
      }

      if (mode === "signup" && !result.data.session) {
        setMessage({ type: "ok", text: "Account created. Check your email to confirm it, then sign in." });
        setMode("signin");
        return;
      }

      window.location.assign(next);
    } catch (error) {
      console.error("[pulse] browser auth failed", error);
      setMessage({ type: "error", text: `Could not sign in: ${errorMessageFrom(error)}` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="pulse-pane w-full max-w-sm p-8">
        <div className="mb-7 flex items-center gap-2.5">
          <PulseMark className="h-9 w-9" />
          <div>
            <div className="font-display text-lg font-semibold leading-tight tracking-tight">Pulse</div>
            <div className="pulse-eyebrow">EDGEx Tasks</div>
          </div>
        </div>

        <h1 className="pulse-title">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in with your email and password."
            : "You will confirm your email before the first sign in."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        {okMessage && (
          <p className="mt-3 text-sm text-emerald-600">{okMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
        )}
        {message && (
          <p className={`mt-3 text-sm ${message.type === "ok" ? "text-emerald-600" : "text-destructive"}`}>
            {message.text}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
          }}
          className="mt-5 rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {mode === "signin" ? "Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function errorMessageFrom(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown auth error";
  }
}
