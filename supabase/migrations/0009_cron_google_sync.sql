-- Migration 0009: schedule the push-to-google sync job
--
-- Mirrors 0007 (reminders). Every 2 minutes, pg_cron invokes the
-- `push-to-google` Edge Function over HTTP (via pg_net). That function finds
-- tasks marked pending/delete_pending and syncs them OUT to Google Calendar.
--
-- Prerequisites (one-time):
--   * Edge Function `push-to-google` deployed:
--       supabase functions deploy push-to-google --no-verify-jwt
--   * Function secrets set:
--       supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
--         CRON_SECRET=<same value as pulse_cron_secret in Vault>
--   * Vault secrets already exist from 0007:
--       pulse_edge_url   = https://mdkyijbgvxedelcqcouu.supabase.co
--       pulse_cron_secret = <CRON_SECRET>

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any prior copy (idempotent re-runs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pulse-push-to-google') THEN
    PERFORM cron.unschedule('pulse-push-to-google');
  END IF;
END;
$$;

-- Every 2 minutes. net.http_post returns immediately (async); the Edge
-- Function does the work. The shared secret header lets the function reject
-- any caller that isn't this job.
SELECT cron.schedule(
  'pulse-push-to-google',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pulse_edge_url')
               || '/functions/v1/push-to-google',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pulse_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
