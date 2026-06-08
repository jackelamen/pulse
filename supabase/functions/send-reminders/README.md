# send-reminders — deploy & setup

Server-side reminder dispatcher. Replaces the old in-browser `setInterval`
poller in `public/sw.js`, which never ran when Pulse was closed because browsers
kill idle service workers within ~30s. Now pg_cron calls this function every
minute and it sends Web Push for any due reminder across all users.

## One-time setup

All commands assume the Supabase CLI is linked to the project
(`supabase link --project-ref mdkyijbgvxedelcqcouu`).

### 1. Reuse your existing VAPID keys

These are the same keys already in your Next.js env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`
and `VAPID_PRIVATE_KEY`). Do NOT generate new ones, or existing browser
subscriptions stop working.

### 2. Pick a CRON_SECRET

Any random string. It guards the function so only the cron job can call it.

```bash
openssl rand -hex 16   # copy the output
```

### 3. Set the function secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<your NEXT_PUBLIC_VAPID_PUBLIC_KEY>" \
  VAPID_PRIVATE_KEY="<your VAPID_PRIVATE_KEY>" \
  VAPID_SUBJECT="mailto:jack@theedgex.com" \
  CRON_SECRET="<the string from step 2>"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
Edge runtime — you do not set those.

### 4. Deploy the function

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

`--no-verify-jwt` is required: the caller is pg_cron, not a logged-in user. The
function does its own auth via the `x-cron-secret` header.

### 5. Configure the two Postgres settings the cron job reads

Run as the project owner (SQL editor or `psql`), using the SAME CRON_SECRET:

```sql
ALTER DATABASE postgres
  SET app.settings.edge_url = 'https://mdkyijbgvxedelcqcouu.supabase.co';
ALTER DATABASE postgres
  SET app.settings.cron_secret = '<the string from step 2>';
```

### 6. Apply the cron migration

```bash
supabase db push     # applies migrations/0007_cron_reminders.sql
```

This enables `pg_cron` + `pg_net` and schedules `pulse-send-reminders` every
minute.

## Verify it works

```sql
-- Job is registered
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'pulse-send-reminders';

-- Recent runs (look for status = 'succeeded')
SELECT runid, status, return_message, start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'pulse-send-reminders')
ORDER BY start_time DESC LIMIT 5;
```

End-to-end test: set a task's `reminder_at` to ~2 minutes from now, fully close
Pulse on your phone, and wait. The notification should arrive.

You can also invoke the function directly:

```bash
curl -X POST \
  'https://mdkyijbgvxedelcqcouu.supabase.co/functions/v1/send-reminders' \
  -H 'x-cron-secret: <your CRON_SECRET>'
# -> {"fired":N,"tasks":N,"stale":0}
```

## Cleanup (optional)

The old browser-driven route `app/api/push/notify/route.ts` is now redundant.
You can delete it, or keep it as a manual "test push" endpoint. The service
worker no longer calls it either way.

## Notes / tradeoffs

- **Granularity is 1 minute.** A reminder set for 9:00:30 fires at 9:01. Fine
  for task reminders; don't use this for second-precision alarms.
- **The function clears `reminder_at` after firing**, so each reminder fires
  once. Recurring reminders would need their own next-occurrence logic.
- **Timezone**: `reminder_at` is `timestamptz`, compared against `now()` in UTC,
  so it's timezone-correct as long as the app writes proper UTC timestamps.
