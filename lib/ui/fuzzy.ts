/**
 * Tiny fuzzy match. Returns a score for query against text, higher is better.
 * 0 = no match. Boosts: prefix match, word-boundary match, contiguous run.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 1000 + q.length;
  let score = 0;
  let ti = 0;
  let lastMatchedAt = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    if (found === lastMatchedAt + 1) score += 4; // contiguous bonus
    if (found === 0 || /\s|[-_]/.test(t[found - 1])) score += 6; // word boundary
    score += 1;
    lastMatchedAt = found;
    ti = found + 1;
  }
  // shorter text wins all else equal
  score += Math.max(0, 20 - t.length);
  return score;
}
