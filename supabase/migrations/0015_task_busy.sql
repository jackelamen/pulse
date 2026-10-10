-- Migration 0015: busy / free flag for tasks
--
-- tasks.all_day already existed (0001) but nothing in the UI could set it.
-- All-day tasks are now first-class on the calendar, and any scheduled task
-- (all-day or timed) can be marked busy or free. Free items still show on the
-- calendar but don't block time, and sync to Google Calendar as
-- transparency=transparent ("Show me as: Free").
--
-- Default true: every existing timed task keeps behaving as busy. The UI and
-- quick-add default new all-day tasks to free (matching Google's behavior for
-- all-day events) and let the person flip it.
alter table public.tasks
  add column if not exists busy boolean not null default true;

comment on column public.tasks.busy is
  'Whether the task blocks time on the calendar. false = free / transparent (synced to Google as transparency=transparent).';
