-- Pulse — M4 focus sessions + integrity fixes.
-- Idempotent where possible; intended to run after 0001 and 0002.

------------------------------------------------------------
-- Ownership-safe relationship keys
------------------------------------------------------------
create unique index if not exists lists_id_user_uidx
  on public.lists (id, user_id);

create unique index if not exists tasks_id_user_uidx
  on public.tasks (id, user_id);

create unique index if not exists folders_id_user_uidx
  on public.folders (id, user_id);

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'tasks' and constraint_name = 'tasks_list_id_fkey'
  ) then
    alter table public.tasks drop constraint tasks_list_id_fkey;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'tasks' and constraint_name = 'tasks_list_owner_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_list_owner_fkey
      foreign key (list_id, user_id) references public.lists (id, user_id);
  end if;

  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'tasks' and constraint_name = 'tasks_parent_task_id_fkey'
  ) then
    alter table public.tasks drop constraint tasks_parent_task_id_fkey;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'tasks' and constraint_name = 'tasks_parent_owner_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_parent_owner_fkey
      foreign key (parent_task_id, user_id) references public.tasks (id, user_id) on delete cascade;
  end if;

  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'tasks' and constraint_name = 'tasks_recurrence_parent_id_fkey'
  ) then
    alter table public.tasks drop constraint tasks_recurrence_parent_id_fkey;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'tasks' and constraint_name = 'tasks_recurrence_parent_owner_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_recurrence_parent_owner_fkey
      foreign key (recurrence_parent_id, user_id) references public.tasks (id, user_id) on delete cascade;
  end if;

  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'lists' and constraint_name = 'lists_folder_id_fkey'
  ) then
    alter table public.lists drop constraint lists_folder_id_fkey;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'lists' and constraint_name = 'lists_folder_owner_fkey'
  ) then
    alter table public.lists
      add constraint lists_folder_owner_fkey
      foreign key (folder_id, user_id) references public.folders (id, user_id);
  end if;
end$$;

------------------------------------------------------------
-- Tags: make client upsert conflict target concrete
------------------------------------------------------------
create unique index if not exists tags_user_name_exact_uidx
  on public.tags (user_id, name);

------------------------------------------------------------
-- focus_sessions
------------------------------------------------------------
create table if not exists public.focus_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id         uuid,
  started_at      timestamptz not null,
  ended_at        timestamptz,
  planned_minutes int not null default 25,
  actual_minutes  int,
  mode            text not null default 'pomodoro' check (mode in ('pomodoro','flow','custom')),
  interruptions   int not null default 0,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint focus_sessions_task_owner_fkey
    foreign key (task_id, user_id) references public.tasks (id, user_id)
);

create index if not exists focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc)
  where deleted_at is null;

create index if not exists focus_sessions_user_task_idx
  on public.focus_sessions (user_id, task_id, started_at desc)
  where deleted_at is null and task_id is not null;

drop trigger if exists focus_sessions_set_updated_at on public.focus_sessions;
create trigger focus_sessions_set_updated_at
  before update on public.focus_sessions
  for each row execute function public.set_updated_at();

alter table public.focus_sessions enable row level security;

drop policy if exists "focus_sessions owner read"   on public.focus_sessions;
drop policy if exists "focus_sessions owner write"  on public.focus_sessions;
drop policy if exists "focus_sessions owner update" on public.focus_sessions;
drop policy if exists "focus_sessions owner delete" on public.focus_sessions;

create policy "focus_sessions owner read"
  on public.focus_sessions for select
  using (auth.uid() = user_id);

create policy "focus_sessions owner write"
  on public.focus_sessions for insert
  with check (auth.uid() = user_id);

create policy "focus_sessions owner update"
  on public.focus_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "focus_sessions owner delete"
  on public.focus_sessions for delete
  using (auth.uid() = user_id);
