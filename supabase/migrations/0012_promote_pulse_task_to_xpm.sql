-- Migration 0012: promote a Pulse-native task into a real xPM task
--
-- Reverse direction of the existing Pulse<->xPM bridge. Until now,
-- pulse_xpm_task_links only got a row (and its xpm_task_id populated) when
-- xPM pushed a task INTO Pulse via sendTaskToPulse (see MyTasks.jsx). There
-- was no path for a task CREATED in Pulse to become a real xpm_tasks row.
--
-- The link table already anticipated this: sync_status allows a 'promoted'
-- value that nothing wrote until now.
--
-- Flow:
--   1. Pulse UI lets the user attribute a task to a Workspace -> Space ->
--      Project. Only workspace_id + project_id need to be stored (a project
--      row already carries its own space_id), so the client upserts ONE row
--      into pulse_xpm_task_links: (user_id, pulse_task_id, xpm_workspace_id,
--      xpm_project_id, xpm_task_id: null).
--   2. This trigger sees xpm_project_id set with no xpm_task_id yet, reads
--      the Pulse task, creates the matching xpm_tasks row (status mapped,
--      priority mapped, assignee auto-set to the creating user), and writes
--      the new id back onto the link row with sync_status = 'promoted'.
--   3. The existing trg_sync_pulse_to_xpm / trg_sync_xpm_to_pulse triggers
--      take over from there for completion-status mirroring -- unchanged.
--
-- Reassignment: if the user later points an already-promoted task at a
-- different project, the matching xpm_tasks row is MOVED (project_id
-- updated) rather than a second xpm_task being created.
--
-- Unlinking: intentionally out of scope here. Removing/nulling the link row
-- does NOT delete or archive the xpm_task -- it's treated as an independent
-- xPM task at that point, matching Jack's "leave untouched" preference so an
-- accidental unlink can never destroy real project data.
--
-- SECURITY DEFINER (matching sync_pulse_to_xpm / sync_xpm_to_pulse) so the
-- write into xpm_tasks doesn't depend on RLS lining up inside the trigger.

create or replace function public.promote_pulse_task_to_xpm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pulse_task record;
  new_xpm_id uuid;
  mapped_status text;
  mapped_priority text;
begin
  -- Nothing to do until a project has been chosen.
  if new.xpm_project_id is null then
    return new;
  end if;

  if new.xpm_task_id is null then
    -- Not yet promoted: create the xpm_tasks row.
    select t.title, t.notes, t.status, t.due_at, t.priority
      into pulse_task
      from public.tasks t
     where t.id = new.pulse_task_id::uuid;

    if not found then
      -- Pulse task vanished (deleted) between the client insert and this
      -- trigger firing -- nothing to promote.
      return new;
    end if;

    mapped_status := case when pulse_task.status = 'done' then 'DONE' else 'TODO' end;
    mapped_priority := case pulse_task.priority
      when 1 then 'LOW'
      when 2 then 'MEDIUM'
      when 3 then 'HIGH'
      else null
    end;

    insert into public.xpm_tasks (
      workspace_id, project_id, title, description, status, priority,
      due_date, assignee_id, created_by
    ) values (
      new.xpm_workspace_id, new.xpm_project_id, pulse_task.title, pulse_task.notes,
      mapped_status, mapped_priority, pulse_task.due_at::date, new.user_id, new.user_id
    )
    returning id into new_xpm_id;

    update public.pulse_xpm_task_links
       set xpm_task_id = new_xpm_id,
           sync_status = 'promoted',
           updated_at = now()
     where id = new.id;

  elsif tg_op = 'UPDATE' and new.xpm_project_id is distinct from old.xpm_project_id then
    -- Already promoted, moved to a different project.
    update public.xpm_tasks
       set project_id = new.xpm_project_id,
           updated_at = now()
     where id = new.xpm_task_id;
  end if;

  return new;
end;
$$;

-- Fires on every insert, and on update only when xpm_project_id is actually
-- part of the SET list -- so the writeback UPDATE above (which only touches
-- xpm_task_id / sync_status / updated_at) never re-triggers itself.
drop trigger if exists trg_promote_pulse_to_xpm on public.pulse_xpm_task_links;
create trigger trg_promote_pulse_to_xpm
  after insert or update of xpm_project_id on public.pulse_xpm_task_links
  for each row
  when (new.xpm_project_id is not null)
  execute function public.promote_pulse_task_to_xpm();
