"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, BarChart3, Coffee, Pause, Play, Square, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusableTasks } from "@/lib/focus/queries";
import {
  useCreateFocusSession,
  useLast7FocusSessions,
  useRecentFocusSessions,
} from "@/lib/focus/queries";
import { useUserSettings } from "@/lib/settings/queries";
import { addDays, formatTime, startOfDay } from "@/lib/date";
import type { FocusMode } from "@/lib/focus/types";
import type { Task } from "@/lib/tasks/types";

type TimerState = "idle" | "running" | "paused" | "overtime";

export function FocusClient() {
  const settings = useUserSettings();
  const tasks = useFocusableTasks();
  const recent = useRecentFocusSessions();
  const last7 = useLast7FocusSessions();
  const createSession = useCreateFocusSession();

  const focusMinutes = settings.data?.pomodoro_focus_minutes ?? 25;
  const strictMode = settings.data?.pomodoro_strict_mode ?? false;
  const defaultCustomMinutes = 45;

  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [mode, setMode] = useState<FocusMode>("pomodoro");
  const [plannedMinutes, setPlannedMinutes] = useState(focusMinutes);
  const [state, setState] = useState<TimerState>("idle");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [interruptions, setInterruptions] = useState(0);
  const [note, setNote] = useState("");
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (state === "idle" && mode === "pomodoro") setPlannedMinutes(focusMinutes);
  }, [focusMinutes, mode, state]);

  useEffect(() => {
    if (state !== "running" && state !== "overtime") return;
    const id = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (mode === "flow") return;
    const plannedSeconds = plannedMinutes * 60;
    if (state !== "running" || elapsedSeconds < plannedSeconds) return;
    if (strictMode) {
      stopSession(true);
      return;
    }
    softChime();
    setState("overtime");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds, mode, plannedMinutes, state, strictMode]);

  const selectedTask = useMemo(
    () => (tasks.data ?? []).find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks.data]
  );

  const plannedSeconds = mode === "flow" ? Math.max(elapsedSeconds, 1) : plannedMinutes * 60;
  const remaining = Math.max(plannedSeconds - elapsedSeconds, 0);
  const overtimeSeconds = Math.max(elapsedSeconds - plannedSeconds, 0);
  const progress = mode === "flow" ? 0.72 : plannedSeconds > 0 ? Math.min(elapsedSeconds / plannedSeconds, 1) : 0;

  function chooseMode(nextMode: FocusMode) {
    if (state !== "idle") return;
    setMode(nextMode);
    if (nextMode === "pomodoro") setPlannedMinutes(focusMinutes);
    if (nextMode === "flow") setPlannedMinutes(0);
    if (nextMode === "custom") setPlannedMinutes(defaultCustomMinutes);
    setElapsedSeconds(0);
  }

  function startSession() {
    setStartedAt(new Date());
    setElapsedSeconds(0);
    setInterruptions(0);
    setNote("");
    setState("running");
  }

  async function stopSession(autoStopped = false) {
    if (stopping) return;
    if (!startedAt) {
      setState("idle");
      return;
    }
    setStopping(true);
    const endedAt = new Date();
    const actualMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    try {
      await createSession.mutateAsync({
        task_id: selectedTaskId || null,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        planned_minutes: plannedMinutes,
        actual_minutes: actualMinutes,
        mode,
        interruptions,
        note: note.trim() || (autoStopped ? "Strict mode auto-stopped." : null),
      });
      setState("idle");
      setStartedAt(null);
      setElapsedSeconds(0);
      setInterruptions(0);
      setNote("");
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="pulse-pane overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <ModeButton active={mode === "pomodoro"} disabled={state !== "idle"} onClick={() => chooseMode("pomodoro")}>
              Pomodoro
            </ModeButton>
            <ModeButton active={mode === "flow"} disabled={state !== "idle"} onClick={() => chooseMode("flow")}>
              Flow
            </ModeButton>
            <ModeButton active={mode === "custom"} disabled={state !== "idle"} onClick={() => chooseMode("custom")}>
              Custom
            </ModeButton>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {strictMode ? <Zap className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
              {strictMode ? "Strict stop" : "Soft suggestion"}
            </div>
          </div>
        </div>

        <div className="px-5 py-8 text-center">
          <div className="mx-auto mb-5 max-w-md">
            <label className="mb-1 block text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Focus task
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              disabled={state !== "idle"}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">Free-form focus session</option>
              {(tasks.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {taskOptionLabel(t)}
                </option>
              ))}
            </select>
            {selectedTask && (
              <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-left text-sm">
                <div className="font-medium">{selectedTask.title}</div>
                {selectedTask.tags.length > 0 && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {selectedTask.tags.map((t) => `#${t}`).join(" ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mx-auto mb-6 grid h-64 w-64 place-items-center rounded-full border border-border bg-muted/30 shadow-inner">
            <div
              className="grid h-56 w-56 place-items-center rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, hsl(var(--muted)) 0deg)`,
              }}
            >
              <div className="grid h-48 w-48 place-items-center rounded-full bg-card">
                <div>
                  <div className="font-display text-5xl font-semibold tracking-tight">
                    {mode === "flow"
                      ? formatClock(elapsedSeconds)
                      : state === "overtime"
                        ? `+${formatClock(overtimeSeconds)}`
                        : formatClock(remaining)}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                    {state === "idle"
                      ? mode === "flow"
                        ? "Open-ended"
                        : mode === "custom"
                          ? "Custom timer"
                          : "Ready"
                      : state === "paused"
                        ? "Paused"
                        : state === "overtime"
                          ? "Still going"
                          : mode === "flow"
                            ? "Flowing"
                            : "In focus"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {mode === "flow" && state === "idle" && (
            <div className="mx-auto mb-5 max-w-sm rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Flow mode counts up until you stop it.
            </div>
          )}

          {state === "overtime" && (
            <div className="mx-auto mb-5 max-w-sm rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              Break time? You can keep going.
            </div>
          )}

          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            {mode !== "flow" ? (
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <AlarmClock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={plannedMinutes}
                  onChange={(e) => {
                    setMode("custom");
                    setPlannedMinutes(Math.max(1, Number(e.target.value) || 1));
                  }}
                  disabled={state !== "idle"}
                  className="w-14 bg-transparent text-right outline-none"
                />
                min
              </label>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                <AlarmClock className="h-4 w-4" />
                Count up
              </div>
            )}
            {state === "idle" ? (
              <Button onClick={startSession} size="lg">
                <Play className="h-4 w-4" />
                Start
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setState((s) => (s === "paused" ? "running" : "paused"))}
                  disabled={state === "overtime" && strictMode}
                >
                  {state === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {state === "paused" ? "Resume" : "Pause"}
                </Button>
                <Button onClick={() => stopSession(false)} disabled={createSession.isPending || stopping}>
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              </>
            )}
          </div>

          <div className="mx-auto grid max-w-xl gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
            <button
              type="button"
              onClick={() => setInterruptions((n) => n + 1)}
              disabled={state === "idle"}
              className="rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <span className="block font-medium">{interruptions}</span>
              <span className="text-xs text-muted-foreground">Interruptions</span>
            </button>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={state === "idle"}
              placeholder="Session note"
              className="min-h-[70px] rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <HistoryChart sessions={last7.data ?? []} />
        <section className="pulse-pane p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Recent sessions
          </h2>
          {(recent.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No focus sessions yet.</p>
          ) : (
            <ul className="space-y-2">
              {(recent.data ?? []).slice(0, 6).map((s) => (
                <li key={s.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.actual_minutes ?? s.planned_minutes}m</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(new Date(s.started_at))}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                    {s.mode} · {s.interruptions} interruptions
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function HistoryChart({ sessions }: { sessions: Array<{ started_at: string; actual_minutes: number | null; planned_minutes: number }> }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }).map((_, i) => addDays(today, i - 6));
  const totals = days.map((d) => {
    const start = startOfDay(d).getTime();
    const end = startOfDay(addDays(d, 1)).getTime();
    return sessions
      .filter((s) => {
        const t = new Date(s.started_at).getTime();
        return t >= start && t < end;
      })
      .reduce((sum, s) => sum + (s.actual_minutes ?? s.planned_minutes), 0);
  });
  const max = Math.max(30, ...totals);

  return (
    <section className="pulse-pane p-4">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Last 7 days
      </h2>
      <div className="flex h-32 items-end gap-2">
        {days.map((d, i) => (
          <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end rounded bg-muted/50 px-1">
              <div
                className="w-full rounded-sm bg-primary"
                style={{ height: `${Math.max(4, (totals[i] / max) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              {d.toLocaleDateString(undefined, { weekday: "narrow" })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        {totals.reduce((a, b) => a + b, 0)} minutes logged
      </div>
    </section>
  );
}

function taskOptionLabel(task: Task) {
  const priority = task.priority > 0 ? ` !${task.priority}` : "";
  return `${task.title}${priority}`;
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function softChime() {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.025;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio is optional; browsers may block it.
  }
}
