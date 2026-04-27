/**
 * Normalize a string for case-insensitive, diacritics-insensitive
 * substring matching. Lowercases, then strips combining diacritical
 * marks via NFD decomposition.
 *
 * "Mueller" with umlaut normalizes to "muller" because the combining
 * diaeresis (U+0308) lives in the U+0300..U+036F block and the regex
 * strip leaves the base letter behind. Same approach as the
 * open-points slugify pattern.
 *
 * Does NOT do German-specific transliteration (`ue` -> umlaut-u); a
 * search for "Mueller" without umlaut will not match "Mueller" with
 * umlaut. For O-17 v1, plain diacritics-strip is the agreed behavior;
 * transliteration is over-engineering for the current scope.
 */
export function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
