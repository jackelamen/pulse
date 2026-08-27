import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="pulse-page">
      <h1 className="pulse-title">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Focus defaults, strict mode, and app preferences.
      </p>
      <div className="mt-6">
        <SettingsClient />
      </div>
    </div>
  );
}
