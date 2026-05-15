import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Focus defaults, strict mode, and app preferences.
      </p>
      <div className="mt-6">
        <SettingsClient />
      </div>
    </div>
  );
}
