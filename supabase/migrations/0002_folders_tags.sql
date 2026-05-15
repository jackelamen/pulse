-- Pulse — M2 schema: folders, tags, subtask index, list.folder_id FK.
-- Idempotent: re-run safe.

------------------------------------------------------------
-- folders
------------------------------------------------------------
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  collapsed  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists folders_user_sort_idx
  on public.folders (user_id, sort_order)
  where deleted_at is null;

drop trigger if exists folders_set_updated_at on public.folders;
create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

alter table public.folders enable row level security;

drop policy if exists "folders owner read"   on public.folders;
drop policy if exists "folders owner write"  on public.folders;
drop policy if exists "folders owner update" on public.folders;
drop policy if exists "folders owner delete" on public.folders;

create policy "folders owner read"   on public.folders for select using (auth.uid() = user_id);
create policy "folders owner write"  on public.folders for insert with check (auth.uid() = user_id);
create policy "folders owner update" on public.folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "folders owner delete" on public.folders for delete using (auth.uid() = user_id);

------------------------------------------------------------
-- list.folder_id FK + index
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'lists' and constraint_name = 'lists_folder_id_fkey'
  ) then
    alter table public.lists
      add constraint lists_folder_id_fkey
      foreign key (folder_id) references public.folders (id) on delete set null;
  end if;
end$$;

create index if not exists lists_user_folder_idx
  on public.lists (user_id, folder_id, sort_order)
  where deleted_at is null;

------------------------------------------------------------
-- tags
------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one row per (user, name) — case-insensitive uniqueness
create unique index if not exists tags_user_name_uidx
  on public.tags (user_id, lower(name));

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

drop policy if exists "tags owner read"   on public.tags;
drop policy if exists "tags owner write"  on public.tags;
drop policy if exists "tags owner update" on public.tags;
drop policy if exists "tags owner delete" on public.tags;

create policy "tags owner read"   on public.tags for select using (auth.uid() = user_id);
create policy "tags owner write"  on public.tags for insert with check (auth.uid() = user_id);
create policy "tags owner update" on public.tags for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags owner delete" on public.tags for delete using (auth.uid() = user_id);

------------------------------------------------------------
-- subtask lookup
------------------------------------------------------------
create index if not exists tasks_parent_idx
  on public.tasks (parent_task_id, sort_order)
  where deleted_at is null;
