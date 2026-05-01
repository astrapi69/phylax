import { findMatchRanges, splitQuery, type MatchRange } from './searchMatches';

/**
 * One input field ready to be scanned for matches. Caller flattens
 * its data structure into this shape in DISPLAY ORDER so the cursor
 * assigned to each match matches the visual top-to-bottom reading
 * order; Up/Down navigation then follows that order.
 */
export interface FieldEntry {
  /** Stable identifier the rendering layer can look up. */
  readonly key: string;
  /** The text scanned for `findMatchRanges`. */
  readonly text: string;
}

/** Per-field result: where matches sit in `text` and the global
 *  1-based index of the first match for this field. */
export interface FieldMatch {
  readonly ranges: MatchRange[];
  readonly startIndex: number;
}

/** Map from `FieldEntry.key` to the field's match metadata. */
export type MatchPlan = ReadonlyMap<string, FieldMatch>;

export interface BuildFieldMatchPlanResult {
  readonly matchPlan: MatchPlan;
  readonly totalMatches: number;
}

/**
 * Build a per-field match plan in display order so every rendered
 * mark gets a sequential 1-based global index. Drives the
 * "X von N Treffer" counter and Up/Down nav across search views.
 *
 * Empty / whitespace-only query returns an empty plan with
 * `totalMatches = 0`. Fields with zero matches are omitted from the
 * plan entirely.
 *
 * Caller responsibility:
 * - Flatten data structures into `fields` in display order.
 * - Memoise the call (`useMemo` over `[fields, query]`).
 *
 * P-22b/c/d-polish-2: extracted from ObservationsView so Lab-Values,
 * Supplements, Open-Points reuse the same per-mark counter. Smoke
 * surfaced the row-level vs mark-level counter mismatch.
 */
export function buildFieldMatchPlan(
  fields: readonly FieldEntry[],
  query: string,
): BuildFieldMatchPlanResult {
  const plan = new Map<string, FieldMatch>();
  const terms = splitQuery(query);
  if (terms.length === 0) return { matchPlan: plan as MatchPlan, totalMatches: 0 };

  let cursor = 1;
  for (const { key, text } of fields) {
    const ranges = findMatchRanges(text, terms);
    if (ranges.length > 0) {
      plan.set(key, { ranges, startIndex: cursor });
      cursor += ranges.length;
    }
  }
  return { matchPlan: plan as MatchPlan, totalMatches: cursor - 1 };
}
