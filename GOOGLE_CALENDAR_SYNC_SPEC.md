# Pulse → Google Calendar Sync (one-way) — Technical Spec

**Status:** Plan, not built. No Pulse code has been changed by this document.
**Scope:** One-way sync. Pulse is the source of truth and pushes scheduled tasks
out to Google Calendar. Changes made directly in Google are never read back.
**Decisions locked:** background queue (not synchronous); recurring tasks
skipped in v1.

---

## 1. What "one-way" means here

Pulse owns the data. The sync loop is just three operations on Google's side:

| Pulse event | Google action |
|---|---|
| Task with a `start_at` is created | Create a Google event, store its id back on the task |
| Synced task is edited (time, title, duration, all-day) | Patch the existing Google event by stored id |
| Synced task is deleted, completed, or unscheduled (`start_at` cleared) | Delete the Google event |

Accepted tradeoff: if you edit an event directly in Google, Pulse does not know
and will overwrite or ignore it. That is inherent to one-way and is fine when
the workflow is "manage in Pulse, view in Google."

A task is **syncable** when: `start_at is not null`, `deleted_at is null`, and
`recurrence_rule is null` (recurring tasks are out of scope for v1 — see §7).

---

## 2. Google Cloud Console setup

OAuth client type: **Web application**.

**Authorized redirect URIs**

```
https://lightskyblue-wolverine-166414.hostingersite.com/auth/google/callback
http://localhost:3000/auth/google/callback
```

**Authorized JavaScript origins**

```
https://lightskyblue-wolverine-166414.hostingersite.com
http://localhost:3000
```

Notes:
- The redirect URI must match what Pulse sends character-for-character (scheme,
  host, port, path, no trailing slash). Mismatch → `redirect_uri_mismatch`.
- `/auth/google/callback` is deliberately separate from the existing Supabase
  login callback at `/auth/callback`.
- When `tasks.theedgex.com` goes live, add its two entries to the same client.
- Enable the **Google Calendar API** for the project.
- Scope required: `https://www.googleapis.com/auth/calendar.events`
  (create/update/delete events). Request **offline access** + `prompt=consent`
  so Google returns a **refresh token** (needed for background sync).

---

## 3. Token storage (server-side only)

A refresh token is a long-lived credential and must never touch the browser.
Store it in a new Supabase table protected by RLS.

```sql
-- Migration 0008: google calendar account link
create table if not exists public.google_accounts (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  google_email     text,
  refresh_token    text not null,          -- consider Vault / encryption (§9)
  access_token     text,                   -- short-lived cache; optional
  access_expires_at timestamptz,
  target_calendar_id text not null default 'primary',
  sync_enabled     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.google_accounts enable row level security;

create policy "own google account" on public.google_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

The service-role Edge Function (§6) bypasses RLS to read tokens for the cron run.

---

## 4. Schema change on `tasks`

Add columns so Pulse can match a task to its Google event and know what still
needs pushing.

```sql
-- Migration 0008 (same file): sync bookkeeping on tasks
alter table public.tasks
  add column if not exists google_event_id   text,
  add column if not exists google_synced_at  timestamptz,
  add column if not exists google_sync_state text not null default 'none'
    check (google_sync_state in ('none','pending','synced','delete_pending','error'));

-- Find work for the cron run quickly.
create index if not exists tasks_google_sync_idx
  on public.tasks (user_id, google_sync_state)
  where google_sync_state in ('pending','delete_pending');
```

`google_sync_state` is the queue marker:
- `pending` — needs create or update in Google
- `delete_pending` — Google event must be removed (task deleted/unscheduled/completed)
- `synced` — up to date
- `error` — last attempt failed; retried next run

---

## 5. OAuth flow (two routes, mirrors existing auth structure)

**`app/auth/google/route.ts`** — starts the flow. Builds the Google consent URL
with `access_type=offline`, `prompt=consent`, the `calendar.events` scope, and
the redirect URI for the current origin, then redirects the browser to Google.

**`app/auth/google/callback/route.ts`** — Google redirects back here with a
`code`. The route exchanges it for tokens server-side, then upserts the
`refresh_token` (and the user's Google email + chosen calendar) into
`google_accounts` for `auth.uid()`. Redirects back to settings.

These follow the same shape as the existing `app/auth/callback/route.ts`.

---

## 6. The push mechanism (background queue)

Reuses Pulse's proven reminders architecture exactly: pg_cron → Edge Function →
service-role access → Vault secrets.

**Marking work (client side, in existing mutations):**
- Task create/update with a `start_at` → set `google_sync_state = 'pending'`.
- Task delete / unschedule / complete where a `google_event_id` exists →
  set `google_sync_state = 'delete_pending'`.

This is a tiny addition to the existing task mutation functions in
`lib/tasks/queries.ts`. The save stays fast; no Google call happens inline.

**Edge Function `push-to-google` (new):**
1. Invoked by pg_cron on a cadence (e.g. every 2 minutes).
2. Select tasks where `google_sync_state in ('pending','delete_pending')`.
3. For each, load the user's `google_accounts` row; refresh the access token if
   `access_expires_at` has passed (using the stored refresh token).
4. `pending` with no `google_event_id` → **insert** event, store returned id,
   set `synced`. `pending` with an id → **patch** event, set `synced`.
   `delete_pending` → **delete** event, clear id, set `none`.
5. On failure set `error` (it gets retried next run). Drop/relink if Google
   returns 404/410 for a stored event id.

**Field mapping (Pulse task → Google event):**
- `title` → `summary`
- `notes` → `description`
- `start_at` + `duration_minutes` → `start.dateTime` / `end.dateTime`
  (timezone-aware). Default duration if null (e.g. 30 min).
- `all_day = true` → `start.date` / `end.date` (date-only, no time).
- `recurrence_rule` → **ignored in v1**.

**Cron migration** mirrors `0007_cron_reminders.sql`: `cron.schedule` calling
`net.http_post` to the new function URL, guarded by a shared `x-cron-secret`
header read from Vault. New Vault secret for the function URL can reuse
`pulse_edge_url`; reuse `pulse_cron_secret` for the guard.

---

## 7. Recurrence (explicitly deferred)

v1 skips any task with a non-null `recurrence_rule`. Pulse expands recurrences
locally (`lib/tasks/recurrence.ts`) and Google has its own RRULE model with
exception instances; reconciling them is the fiddliest part and is not worth
blocking the first working version. Revisit as v2: translate Pulse's RRULE into
Google's `recurrence` field on a single event.

---

## 8. Settings UI

A small section in `app/(app)/settings`:
- "Connect Google Calendar" button → `/auth/google` (when not linked).
- When linked: show the connected Google email, a calendar picker
  (`target_calendar_id`), a sync on/off toggle (`sync_enabled`), and
  "Disconnect" (deletes the `google_accounts` row; optionally tears down the
  events it created).
- Surface the last sync error if `google_sync_state = 'error'` exists.

Optional: a subtle marker on calendar views showing which tasks are mirrored to
Google.

---

## 9. Security notes

- Refresh token lives only server-side, in an RLS-protected table. For
  defense-in-depth, store it via Supabase Vault rather than a plain column.
- The Edge Function uses the service-role key (bypasses RLS) and must reject any
  caller lacking the shared cron secret — same guard as `send-reminders`.
- Never expose client secret or refresh token to the browser. The OAuth
  client secret lives in Edge Function / server env only.

---

## 10. Build order

1. Google Cloud client + Calendar API enabled + redirect URIs (§2).
2. Migration 0008: `google_accounts` table + `tasks` sync columns (§3, §4).
3. OAuth routes `/auth/google` and `/auth/google/callback` (§5).
4. Settings connect/disconnect UI (§8).
5. Mark sync state in existing task mutations (§6).
6. Edge Function `push-to-google` + deploy + secrets (§6).
7. Cron migration mirroring 0007 (§6).
8. Test: create → appears in Google; edit → updates; delete → removed.

Steps 1–4 give a connected-but-inert state you can verify before wiring the
actual push in 5–7.
