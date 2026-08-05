-- Migration 0014: project-level Pulse tag + two-way recurrence sync
--
-- Part 1: projects.pulse_tag
-- Lets an xPM project define its own tag to send to Pulse instead of the
-- project name (set in xPM's Project Settings -> "Pulse Tag"). xPM's
-- sendTaskToPulse (edgex-pm/src/pages/MyTasks.jsx) falls back to
-- lower(projects.name) when unset.
alter table public.projects
  add column if not exists pulse_tag text;

comment on column public.projects.pulse_tag is
  'Custom tag written to a Pulse task''s tags[] when sent from xPM via sendTaskToPulse. Falls back to lower(projects.name) when null.';

-- Part 2: recurrence sync
-- Extends the existing Pulse<->xPM completion-sync triggers
-- (trg_sync_pulse_to_xpm / trg_sync_xpm_to_pulse) to also mirror recurrence,
-- so marking a task recurring in either app reflects in the other without
-- manual re-entry.
--
-- Format mismatch: xPM stores a simple keyword in xpm_tasks.recurrence_rule
-- (DAILY | WEEKLY | BIWEEKLY | MONTHLY, see TaskPanel.jsx RECURRENCE_OPTIONS)
-- plus a separate recurrence_anchor_date. Pulse stores a full RRULE string
-- in tasks.recurrence_rule (see lib/tasks/recurrence.ts) and derives its
-- anchor from start_at/due_at -- there's no separate anchor column.
--
-- Mapping is best-effort and only covers the four presets xPM's UI actually
-- offers. A Pulse rule outside that set (BYDAY weekday presets, YEARLY,
-- custom RRULEs) has no xPM equivalent, so xPM's recurrence_rule is left
-- untouched rather than silently corrupted to something wrong.
--
-- Anchor mirroring only fills in a *missing* anchor on the receiving side
-- (never overwrites an existing due date the user already set independently
-- in that app) -- consistent with the rest of the bridge not keeping due
-- dates in continuous sync.

create or replace function public.sync_pulse_to_xpm()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mapped_recurrence text;
begin
  if new.status is distinct from old.status then
    if new.status = 'done' then
      update public.xpm_tasks x
      set status = 'DONE',
          completed_at = coalesce(x.completed_at, now()),
          updated_at = now()
      from public.pulse_xpm_task_links l
      where l.pulse_task_id = new.id::text
        and l.xpm_task_id = x.id
        and x.status is distinct from 'DONE';
    elsif new.status = 'todo' then
      update public.xpm_tasks x
      set status = 'TODO',
          completed_at = null,
          updated_at = now()
      from public.pulse_xpm_task_links l
      where l.pulse_task_id = new.id::text
        and l.xpm_task_id = x.id
        and x.status is distinct from 'TODO';
    end if;
  end if;

  if new.recurrence_rule is distinct from old.recurrence_rule then
    mapped_recurrence := case
      when new.recurrence_rule is null then 'NONE'
      when upper(new.recurrence_rule) ~ 'FREQ=DAILY' then 'DAILY'
      when upper(new.recurrence_rule) ~ 'FREQ=WEEKLY' and upper(new.recurrence_rule) ~ 'INTERVAL=2' then 'BIWEEKLY'
      when upper(new.recurrence_rule) ~ 'FREQ=WEEKLY' and upper(new.recurrence_rule) !~ 'BYDAY' then 'WEEKLY'
      when upper(new.recurrence_rule) ~ 'FREQ=MONTHLY' then 'MONTHLY'
      else 'UNMAPPABLE'
    end;

    if mapped_recurrence is distinct from 'UNMAPPABLE' then
      update public.xpm_tasks x
      set recurrence_rule = nullif(mapped_recurrence, 'NONE'),
          recurrence_anchor_date = case
            when mapped_recurrence = 'NONE' then null
            when x.recurrence_anchor_date is not null then x.recurrence_anchor_date
            else coalesce(new.due_at::date, new.start_at::date)
          end,
          updated_at = now()
      from public.pulse_xpm_task_links l
      where l.pulse_task_id = new.id::text
        and l.xpm_task_id = x.id;
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.sync_xpm_to_pulse()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mapped_recurrence text;
begin
  if new.status is distinct from old.status then
    if new.status = 'DONE' then
      update public.tasks t
      set status = 'done',
          completed_at = coalesce(t.completed_at, now()),
          updated_at = now()
      from public.pulse_xpm_task_links l
      where l.xpm_task_id = new.id
        and l.pulse_task_id = t.id::text
        and t.status is distinct from 'done';
    elsif new.status = 'TODO' then
      update public.tasks t
      set status = 'todo',
          completed_at = null,
          updated_at = now()
      from public.pulse_xpm_task_links l
      where l.xpm_task_id = new.id
        and l.pulse_task_id = t.id::text
        and t.status is distinct from 'todo';
    end if;
  end if;

  if new.recurrence_rule is distinct from old.recurrence_rule
     or new.recurrence_anchor_date is distinct from old.recurrence_anchor_date then
    mapped_recurrence := case new.recurrence_rule
      when 'DAILY' then 'FREQ=DAILY'
      when 'WEEKLY' then 'FREQ=WEEKLY'
      when 'BIWEEKLY' then 'FREQ=WEEKLY;INTERVAL=2'
      when 'MONTHLY' then 'FREQ=MONTHLY'
      else null
    end;

    update public.tasks t
    set recurrence_rule = mapped_recurrence,
        due_at = case
          when mapped_recurrence is not null
               and t.due_at is null and t.start_at is null
               and new.recurrence_anchor_date is not null
            then new.recurrence_anchor_date::timestamptz
          else t.due_at
        end,
        updated_at = now()
    from public.pulse_xpm_task_links l
    where l.xpm_task_id = new.id
      and l.pulse_task_id = t.id::text;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sync_pulse_to_xpm on public.tasks;
create trigger trg_sync_pulse_to_xpm
  after update of status, recurrence_rule on public.tasks
  for each row
  execute function public.sync_pulse_to_xpm();

drop trigger if exists trg_sync_xpm_to_pulse on public.xpm_tasks;
create trigger trg_sync_xpm_to_pulse
  after update of status, recurrence_rule, recurrence_anchor_date on public.xpm_tasks
  for each row
  execute function public.sync_xpm_to_pulse();
