export interface FuzzyMatch {
  score: number;
  /** Indices into the haystack that matched, for highlighting. */
  indices: number[];
}

const isBoundary = (s: string, i: number) => i === 0 || /[\s\-_/·.:]/.test(s[i - 1]);

/**
 * Subsequence fuzzy match with prefix, word-start and contiguity bonuses.
 * Returns null when `query` is not a subsequence of `text` (case-insensitive).
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const t = text.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === " ") continue;
    // Greedy: stay contiguous if possible, else prefer the next word-start occurrence, else the next occurrence.
    let found = -1;
    if (prev >= 0 && t[prev + 1] === ch) found = prev + 1;
    else {
      for (let j = ti; j < t.length; j++) {
        if (t[j] === ch && isBoundary(t, j)) {
          found = j;
          break;
        }
      }
      if (found === -1) found = t.indexOf(ch, ti);
    }
    if (found === -1) return null;
    score += 1;
    if (found === prev + 1) score += 3;
    if (isBoundary(t, found)) score += 4;
    if (found === 0) score += 6;
    score -= Math.min(found - ti, 6) * 0.2;
    indices.push(found);
    prev = found;
    ti = found + 1;
  }
  score -= text.length * 0.01;
  return { score, indices };
}
