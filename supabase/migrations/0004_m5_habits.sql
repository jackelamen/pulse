-- Pulse — M5 habits + habit logs.
-- Habits stay separate from tasks; Today joins them only for display.

------------------------------------------------------------
-- habits
------------------------------------------------------------
create table if not exists public.habits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,
  cadence           text not null default 'daily' check (cadence in ('daily','weekdays','weekly','custom')),
  cadence_config    jsonb not null default '{}'::jsonb,
  target_per_period int not null default 1 check (target_per_period > 0),
  color             text,
  icon              text,
  archived_at       timestamptz,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create unique index if not exists habits_id_user_uidx
  on public.habits (id, user_id);

create index if not exists habits_user_sort_idx
  on public.habits (user_id, sort_order)
  where deleted_at is null and archived_at is null;

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

alter table public.habits enable row level security;

drop policy if exists "habits owner read"   on public.habits;
drop policy if exists "habits owner write"  on public.habits;
drop policy if exists "habits owner update" on public.habits;
drop policy if exists "habits owner delete" on public.habits;

create policy "habits owner read"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "habits owner write"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "habits owner update"
  on public.habits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "habits owner delete"
  on public.habits for delete
  using (auth.uid() = user_id);

------------------------------------------------------------
-- habit_logs
------------------------------------------------------------
create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   uuid not null,
  logged_on  date not null,
  count      int not null default 1 check (count > 0),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint habit_logs_habit_owner_fkey
    foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create unique index if not exists habit_logs_habit_day_uidx
  on public.habit_logs (habit_id, logged_on)
  where deleted_at is null;

create index if not exists habit_logs_user_day_idx
  on public.habit_logs (user_id, logged_on desc)
  where deleted_at is null;

drop trigger if exists habit_logs_set_updated_at on public.habit_logs;
create trigger habit_logs_set_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

alter table public.habit_logs enable row level security;

drop policy if exists "habit_logs owner read"   on public.habit_logs;
drop policy if exists "habit_logs owner write"  on public.habit_logs;
drop policy if exists "habit_logs owner update" on public.habit_logs;
drop policy if exists "habit_logs owner delete" on public.habit_logs;

create policy "habit_logs owner read"
  on public.habit_logs for select
  using (auth.uid() = user_id);

create policy "habit_logs owner write"
  on public.habit_logs for insert
  with check (auth.uid() = user_id);

create policy "habit_logs owner update"
  on public.habit_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "habit_logs owner delete"
  on public.habit_logs for delete
  using (auth.uid() = user_id);
