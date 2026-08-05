-- Migration 0013: normalize public.tasks.tags on write
--
-- Pulse's own tag-entry paths all normalize tags client-side (trim, strip
-- leading '#', lowercase) before saving:
--   - lib/lists/queries.ts normalizeTagName()
--   - lib/tasks/parse-quick-add.ts (quick-add #tag parsing)
--   - components/tasks/task-detail.tsx (tags field onBlur)
--
-- xPM's sendTaskToPulse (edgex-pm/src/pages/MyTasks.jsx) writes tags
-- directly into tasks.tags when a task is sent from xPM to Pulse, bypassing
-- all of the above and inheriting the xPM project's original casing (e.g.
-- "SoftLink", "Research & Prep"). xFocus expects lowercase project tags, so
-- those rows silently failed to match until Jack manually renamed them.
--
-- This trigger makes normalization automatic and source-agnostic --
-- it applies no matter which client writes to tasks.tags (xPM direct
-- insert, Pulse UI, any future integration), so no single writer has to
-- remember to normalize.

create or replace function public.normalize_task_tags()
returns trigger
language plpgsql
as $$
begin
  if new.tags is not null then
    select coalesce(array_agg(distinct t order by t), '{}')
      into new.tags
      from (
        select lower(trim(regexp_replace(tag, '^#', ''))) as t
        from unnest(new.tags) as tag
      ) normalized
      where t <> '';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_task_tags on public.tasks;
create trigger trg_normalize_task_tags
  before insert or update of tags on public.tasks
  for each row
  execute function public.normalize_task_tags();

-- One-time backfill: normalize tags already sitting on existing rows
-- (mostly xPM-sourced tasks with mixed-case project tags).
update public.tasks
   set tags = (
     select coalesce(array_agg(distinct t order by t), '{}')
       from (
         select lower(trim(regexp_replace(tag, '^#', ''))) as t
         from unnest(tags) as tag
       ) normalized
       where t <> ''
   )
 where tags is not null
   and tags <> '{}'
   and tags::text ~ '[A-Z#]';
