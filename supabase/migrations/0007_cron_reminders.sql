-- Migration 0007: server-side reminder scheduling
--
-- Replaces the in-browser setInterval poller (public/sw.js) with a real
-- server-side cron job. Every minute, pg_cron invokes the `send-reminders`
-- Edge Function over HTTP (via pg_net). That function finds due reminders for
-- ALL users and sends Web Push — so reminders fire even when Pulse is closed.
--
-- Prerequisites (one-time, set in the Supabase dashboard or CLI):
--   * Edge Function `send-reminders` deployed.
--   * Function secrets set: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
--     CRON_SECRET.
--   * Two Postgres settings below must hold the project URL and the matching
--     CRON_SECRET so this migration can build the request. Set them once with:
--
--       ALTER DATABASE postgres
--         SET app.settings.edge_url = 'https://mdkyijbgvxedelcqcouu.supabase.co';
--       ALTER DATABASE postgres
--         SET app.settings.cron_secret = '<the-same-CRON_SECRET-value>';
--
--     (Run those two as the postgres/owner role, then reconnect so the GUCs
--     are visible. They are read at job-run time via current_setting().)

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Unschedule any prior copy of this job (idempotent re-runs) ───────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pulse-send-reminders') THEN
    PERFORM cron.unschedule('pulse-send-reminders');
  END IF;
END;
$$;

-- ── Schedule: every minute ──────────────────────────────────────────────────
-- pg_net's net.http_post returns immediately (async); the Edge Function does
-- the work. We pass the shared secret in a header so the function can reject
-- any caller that isn't us.
SELECT cron.schedule(
  'pulse-send-reminders',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url     := current_setting('app.settings.edge_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
