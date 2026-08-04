-- Migration 0009: auto-archive old completed tasks
-- A daily pg_cron job archives any task completed more than 30 days ago that
-- hasn't already been archived or deleted. This keeps the logbook recent while
-- preserving everything in the Archive view. Pure SQL, no Edge Function needed.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION auto_archive_old_completed()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE tasks
  SET archived_at = now()
  WHERE completed_at IS NOT NULL
    AND completed_at < now() - interval '30 days'
    AND archived_at IS NULL
    AND deleted_at IS NULL;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pulse-auto-archive') THEN
    PERFORM cron.unschedule('pulse-auto-archive');
  END IF;
END;
$$;

-- Daily at 03:30 UTC.
SELECT cron.schedule(
  'pulse-auto-archive',
  '30 3 * * *',
  $cron$ SELECT auto_archive_old_completed(); $cron$
);
