import { FocusClient } from "./focus-client";

export const metadata = { title: "Focus" };

export default function FocusPage() {
  return (
    <div className="pulse-page-wide flex flex-1 flex-col">
      <header className="mb-6">
        <p className="pulse-eyebrow">Pomodoro · Flow · Distractions</p>
        <h1 className="pulse-title">
          Focus
        </h1>
      </header>
      <FocusClient />
    </div>
  );
}
