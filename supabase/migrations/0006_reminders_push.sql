-- Migration 0006: reminders + push subscriptions
--
-- 1. Add reminder_at to tasks so any task can carry an alarm timestamp.
-- 2. Add push_subscriptions to store Web Push endpoint/keys per user/device.

-- ── tasks: reminder column ──────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz DEFAULT NULL;

-- Index so the alarm-checker query is fast:
--   SELECT id, title, reminder_at FROM tasks
--   WHERE user_id = $1
--     AND reminder_at BETWEEN now() AND now() + interval '2 minutes'
--     AND completed_at IS NULL
--     AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS tasks_reminder_at_idx
  ON tasks (user_id, reminder_at)
  WHERE reminder_at IS NOT NULL AND completed_at IS NULL AND deleted_at IS NULL;

-- ── push_subscriptions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One subscription row per (user, endpoint). Upsert on conflict.
  CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint)
);

-- RLS: users can only see and manage their own subscriptions.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_owner_all"
  ON push_subscriptions
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'push_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER push_subscriptions_updated_at
      BEFORE UPDATE ON push_subscriptions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
