-- Migration 0007: server-side reminder scheduling
--
-- Replaces the in-browser setInterval poller (public/sw.js) with a real
-- server-side cron job. Every minute, pg_cron invokes the `send-reminders`
-- Edge Function over HTTP (via pg_net). That function finds due reminders for
-- ALL users and sends Web Push — so reminders fire even when Pulse is closed.
--
-- The function URL and the shared cron secret are read from Supabase Vault
-- (vault.decrypted_secrets) rather than from database GUCs, because the Vault
-- approach works without superuser/ALTER DATABASE privileges.
--
-- Prerequisites (one-time):
--   * Edge Function `send-reminders` deployed (supabase functions deploy
--     send-reminders --no-verify-jwt).
--   * Function secrets set: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
--     CRON_SECRET. The CRON_SECRET value MUST equal the `pulse_cron_secret`
--     Vault secret below.
--   * Two Vault secrets created (already done in this project):
--       select vault.create_secret(
--         'https://mdkyijbgvxedelcqcouu.supabase.co', 'pulse_edge_url');
--       select vault.create_secret(
--         '<CRON_SECRET>', 'pulse_cron_secret');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any prior copy (idempotent re-runs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pulse-send-reminders') THEN
    PERFORM cron.unschedule('pulse-send-reminders');
  END IF;
END;
$$;

-- Schedule: every minute. net.http_post returns immediately (async); the Edge
-- Function does the work. The shared secret in the x-cron-secret header lets
-- the function reject any caller that isn't this job.
SELECT cron.schedule(
  'pulse-send-reminders',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pulse_edge_url')
               || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pulse_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
