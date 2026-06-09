-- Migration 0008: Google Calendar one-way sync (Pulse -> Google)
--
-- Foundation for pushing scheduled Pulse tasks out to Google Calendar.
-- One-way only: Pulse is the source of truth. Changes made in Google are never
-- read back. See GOOGLE_CALENDAR_SYNC_SPEC.md.
--
-- 1. google_accounts — stores each user's Google OAuth refresh token + the
--    calendar they sync to. Refresh token is a credential: server-side only,
--    protected by RLS so a user can only ever touch their own row.
-- 2. tasks sync bookkeeping — google_event_id (the mirrored event), a sync
--    state machine column, and a synced-at timestamp.

-- ── google_accounts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_accounts (
  user_id             uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  google_email        text,
  refresh_token       text NOT NULL,
  access_token        text,
  access_expires_at   timestamptz,
  target_calendar_id  text NOT NULL DEFAULT 'primary',
  sync_enabled        boolean NOT NULL DEFAULT true,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS: a user can only see and manage their own Google link. The push-to-google
-- Edge Function uses the service-role key and bypasses RLS for the cron run.
ALTER TABLE google_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_accounts_owner_all"
  ON google_accounts
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reuse the shared set_updated_at() trigger fn (defined in migration 0006).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'google_accounts_updated_at'
  ) THEN
    CREATE TRIGGER google_accounts_updated_at
      BEFORE UPDATE ON google_accounts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- ── tasks: sync bookkeeping ─────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS google_event_id   text,
  ADD COLUMN IF NOT EXISTS google_synced_at  timestamptz,
  ADD COLUMN IF NOT EXISTS google_sync_state text NOT NULL DEFAULT 'none'
    CHECK (google_sync_state IN ('none','pending','synced','delete_pending','error'));

-- The cron run selects only tasks that need pushing, so index that hot path.
CREATE INDEX IF NOT EXISTS tasks_google_sync_idx
  ON tasks (user_id, google_sync_state)
  WHERE google_sync_state IN ('pending','delete_pending');
