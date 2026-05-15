import { getSupabaseEnvStatus } from "@/lib/env";

export default function DeploymentErrorPage() {
  const status = getSupabaseEnvStatus();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <section className="pulse-pane max-w-xl p-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Pulse deployment
        </div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Missing production environment
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Hostinger is running Pulse, but the app cannot connect to Supabase yet. Add the
          missing variables in the Hostinger Node app environment, then rebuild/restart the app.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
          <div className="text-sm font-semibold text-foreground">Missing variables</div>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {status.missing.length ? (
              status.missing.map((key) => <li key={key}>{key}</li>)
            ) : (
              <li>No required Supabase variables are missing.</li>
            )}
          </ul>
        </div>

        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          Check <code className="rounded bg-muted px-1.5 py-0.5">/api/health</code> after
          redeploying. It should return <code className="rounded bg-muted px-1.5 py-0.5">ok: true</code>.
        </p>
      </section>
    </main>
  );
}
