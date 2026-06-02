/**
 * Color palette for the PDF export (X-09). Subdued ink-on-paper
 * palette tuned for monochrome printers (each color falls back to a
 * distinguishable grey under desaturation) and for legibility on the
 * default white page background.
 *
 * Values are RGB triples in 0..255 to match jsPDF's
 * `setTextColor(r, g, b)` and `setFillColor(r, g, b)` overloads.
 */
export type RGB = readonly [number, number, number];

export const Palette = {
  /** Near-black for body text; softer than pure `0,0,0`. */
  textPrimary: [33, 33, 33] as RGB,
  /** Secondary text (running header, labels). */
  textSecondary: [102, 102, 102] as RGB,
  /** Footer + muted captions. */
  textMuted: [136, 136, 136] as RGB,

  /** Accent: section headings, header rule, accent underline. */
  accent: [70, 90, 120] as RGB,

  /** AutoTable header fill + text. */
  tableHeader: [60, 60, 80] as RGB,
  tableHeaderText: [255, 255, 255] as RGB,
  /** AutoTable zebra stripe (very light gray-blue). */
  tableStripe: [245, 245, 248] as RGB,

  /** Lab assessment colors. Mirror the in-app O-13 pattern
   *  (LabValuesTable.tsx) and extend with an amber tier for the
   *  out-of-range markers German labs commonly print. */
  abnormalCritical: [180, 30, 30] as RGB,
  abnormalNotable: [200, 110, 0] as RGB,
} as const;

/**
 * Classify a free-text lab assessment string for color treatment.
 *
 * - `'critical'` mirrors the O-13 in-app rule (assessment includes
 *   the literal "kritisch") and uses `Palette.abnormalCritical`.
 * - `'notable'` covers the typical DE-lab out-of-range markers
 *   (`unterhalb`, `oberhalb`, `erhöht`/`erhoeht`, `erniedrigt`,
 *   `grenzwertig`) and uses `Palette.abnormalNotable`.
 * - `'normal'` is everything else, including `undefined` and the
 *   literal "normal"; renders with `Palette.textPrimary`.
 *
 * Case-insensitive substring match. Intentionally tolerant: the
 * goal is a useful visual hint, not a clinical classifier.
 */
export function classifyAssessment(
  assessment: string | undefined,
): 'critical' | 'notable' | 'normal' {
  if (!assessment) return 'normal';
  const lower = assessment.toLowerCase();
  if (lower.includes('kritisch')) return 'critical';
  if (
    lower.includes('unterhalb') ||
    lower.includes('oberhalb') ||
    lower.includes('erhöht') ||
    lower.includes('erhoeht') ||
    lower.includes('erniedrigt') ||
    lower.includes('grenzwertig')
  ) {
    return 'notable';
  }
  return 'normal';
}
