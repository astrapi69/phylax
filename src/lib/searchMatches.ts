import { normalizeForSearch } from './normalizeForSearch';

/**
 * Half-open range of original-text character indices `[start, end)`.
 */
export interface MatchRange {
  start: number;
  end: number;
}

/**
 * Split a search query into normalized, non-empty terms. Mirrors the
 * splitting used by `filterObservations`; kept as its own helper so
 * the highlight pipeline matches the filter semantics exactly.
 */
export function splitQuery(query: string): string[] {
  const trimmed = query.trim();
  if (trimmed === '') return [];
  return trimmed
    .split(/\s+/)
    .map(normalizeForSearch)
    .filter((t) => t.length > 0);
}

/**
 * Find every occurrence of every term in `text`, returning ranges in
 * the ORIGINAL text. Case- and diacritics-insensitive: matching uses
 * `normalizeForSearch` (NFD decomposition + combining-marks strip),
 * but the returned ranges point at the user-visible original text so
 * highlighting wraps the rendered glyphs and not their decomposed
 * normal forms.
 *
 * The mapping between normalized and original positions is built
 * char-by-char: each original char gets normalized in isolation and
 * the normalized characters it produces all map back to its original
 * index. NFC inputs (the common case) yield 1:1 mappings; pre-
 * decomposed inputs (rare) yield 1:0 for the combining marks, which
 * end up just outside the highlight range and render attached to
 * their base char visually. Acceptable v1 trade-off.
 *
 * Ranges are returned sorted by `start` and de-overlapped so the
 * caller can paint them sequentially without merging logic. Two
 * overlapping ranges (e.g., terms "test" and "es" both matching
 * "tester") merge into the union range.
 */
export function findMatchRanges(text: string, terms: string[]): MatchRange[] {
  if (terms.length === 0 || text === '') return [];

  let normalized = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === undefined) continue;
    const piece = normalizeForSearch(ch);
    for (let j = 0; j < piece.length; j++) {
      map.push(i);
    }
    normalized += piece;
  }

  const raw: MatchRange[] = [];
  for (const term of terms) {
    if (term === '') continue;
    let idx = 0;
    while ((idx = normalized.indexOf(term, idx)) !== -1) {
      const startOrig = map[idx];
      if (startOrig === undefined) {
        idx += term.length;
        continue;
      }
      const lastNormIdx = idx + term.length - 1;
      const lastOrigIdx = map[lastNormIdx];
      const endOrig = lastOrigIdx === undefined ? text.length : lastOrigIdx + 1;
      raw.push({ start: startOrig, end: endOrig });
      idx += term.length;
    }
  }

  if (raw.length === 0) return [];
  raw.sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: MatchRange[] = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end });
    }
  }
  return merged;
}
