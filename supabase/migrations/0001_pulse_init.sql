-- Pulse — initial schema (M0/M1)
-- Tables: lists, tasks, user_settings.
-- Folders, tags, habits, habit_logs, focus_sessions, views land in later migrations.
--
-- Naming is deliberately neutral: these tables live in the shared TheEDGEx
-- Postgres (mdkyijbgvxedelcqcouu) so other HTML modules (work.html, goals.html,
-- wellness.html) can read from them via the Supabase JS client.
--
-- Every table is RLS-locked to user_id = auth.uid().

set check_function_bodies = off;

------------------------------------------------------------
-- Helper: updated_at trigger
------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

------------------------------------------------------------
-- lists
------------------------------------------------------------
create table if not exists public.lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id    uuid,
  name         text not null,
  color        text,
  icon         text,
  view_mode    text not null default 'list' check (view_mode in ('list','board','timeline')),
  sort_order   int  not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists lists_user_sort_idx
  on public.lists (user_id, sort_order)
  where deleted_at is null;

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();

alter table public.lists enable row level security;

drop policy if exists "lists owner read"   on public.lists;
drop policy if exists "lists owner write"  on public.lists;
drop policy if exists "lists owner update" on public.lists;
drop policy if exists "lists owner delete" on public.lists;

create policy "lists owner read"
  on public.lists for select
  using (auth.uid() = user_id);

create policy "lists owner write"
  on public.lists for insert
  with check (auth.uid() = user_id);

create policy "lists owner update"
  on public.lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lists owner delete"
  on public.lists for delete
  using (auth.uid() = user_id);

------------------------------------------------------------
-- tasks
------------------------------------------------------------
create table if not exists public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id               uuid references public.lists (id) on delete set null,
  parent_task_id        uuid references public.tasks (id) on delete cascade,
  title                 text not null,
  notes                 text,
  priority              smallint not null default 0 check (priority between 0 and 3),
  status                text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  start_at              timestamptz,
  due_at                timestamptz,
  duration_minutes      int,
  all_day               boolean not null default false,
  completed_at          timestamptz,
  recurrence_rule       text,                                       -- RRULE on the template row
  recurrence_parent_id  uuid references public.tasks (id) on delete cascade,
  sort_order            numeric not null default 0,                 -- fractional indexing
  tags                  text[]  not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create index if not exists tasks_user_list_sort_idx
  on public.tasks (user_id, list_id, sort_order)
  where deleted_at is null;

create index if not exists tasks_user_due_idx
  on public.tasks (user_id, due_at)
  where deleted_at is null and completed_at is null;

create index if not exists tasks_user_start_idx
  on public.tasks (user_id, start_at)
  where deleted_at is null and completed_at is null;

create index if not exists tasks_user_completed_idx
  on public.tasks (user_id, completed_at desc)
  where completed_at is not null;

create index if not exists tasks_tags_gin
  on public.tasks using gin (tags);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "tasks owner read"   on public.tasks;
drop policy if exists "tasks owner write"  on public.tasks;
drop policy if exists "tasks owner update" on public.tasks;
drop policy if exists "tasks owner delete" on public.tasks;

create policy "tasks owner read"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks owner write"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks owner update"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks owner delete"
  on public.tasks for delete
  using (auth.uid() = user_id);

------------------------------------------------------------
-- user_settings (1 row per user)
------------------------------------------------------------
create table if not exists public.user_settings (
  user_id                  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme                    text not null default 'auto' check (theme in ('light','dark','auto')),
  accent                   text not null default 'coral',
  density                  text not null default 'comfortable' check (density in ('comfortable','compact')),
  week_starts_on           smallint not null default 1,                  -- 0 = Sunday, 1 = Monday
  work_hours_start         time     not null default '09:00',
  work_hours_end           time     not null default '18:00',
  pomodoro_focus_minutes   int      not null default 25,
  pomodoro_break_minutes   int      not null default 5,
  pomodoro_strict_mode     boolean  not null default false,              -- soft suggestion is the default
  default_view             text     not null default '/today',
  updated_at               timestamptz not null default now()
);

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "user_settings owner read"   on public.user_settings;
drop policy if exists "user_settings owner write"  on public.user_settings;
drop policy if exists "user_settings owner update" on public.user_settings;

create policy "user_settings owner read"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings owner write"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings owner update"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
