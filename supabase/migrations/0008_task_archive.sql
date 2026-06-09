-- Migration 0008: task archive
-- archived_at marks a task as archived (put away). NULL = not archived.
-- Distinct from completed_at (done) and deleted_at (soft-deleted / trash).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- Index for the archive view (per-user, newest first) and for the
-- auto-archive sweep that looks for old completed, not-yet-archived tasks.
CREATE INDEX IF NOT EXISTS tasks_archived_at_idx
  ON tasks (user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_auto_archive_idx
  ON tasks (completed_at)
  WHERE completed_at IS NOT NULL AND archived_at IS NULL AND deleted_at IS NULL;
