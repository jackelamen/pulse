/**
 * Fractional indexing for drag-reorder.
 *
 * `sort_order` is a Postgres numeric column. To insert an item between two
 * neighbors, we use the midpoint of their sort_order values, so reorders are
 * O(1) writes (no renumbering of siblings).
 *
 * Initial values use coarse spacing (1024.0) so consecutive midpoints stay
 * comfortably representable in double precision. After ~50 inserts at the
 * same spot the numbers approach precision limits; we don't worry about that
 * yet — a renumber job can run nightly later.
 */
export const STEP = 1024;

export function midpoint(before: number | null, after: number | null): number {
  if (before == null && after == null) return 0;
  if (before == null && after != null) return after - STEP;
  if (after == null && before != null) return before + STEP;
  return (before! + after!) / 2;
}
