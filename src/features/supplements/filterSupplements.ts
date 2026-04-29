import { normalizeForSearch } from '../../lib';
import type { Supplement, SupplementCategory } from '../../domain';

/**
 * Pre-labeled supplement group: same shape as `SupplementGroup` from
 * `useSupplements` but with the translated category label resolved
 * upfront so the filter can match against the visible label text.
 *
 * The View layer resolves labels via `t(`category.${cat}`)` and passes
 * the labeled groups in. Keeping the filter pure (no `useTranslation`)
 * lets it stay testable without a React tree.
 */
export interface LabeledSupplementGroup {
  category: SupplementCategory;
  label: string;
  supplements: Supplement[];
}

export interface FilterSupplementsOptions {
  query?: string;
}

export interface FilterSupplementsResult {
  groups: LabeledSupplementGroup[];
  matchCount: number;
  totalCount: number;
}

/**
 * Filter supplement groups by an optional search query whose terms
 * must all match (AND across whitespace-split terms).
 *
 * Group-keep semantic (mirrors Observations theme group): a group
 * is retained when EITHER its translated label matches the query OR
 * any of its supplements matches. When retained, ALL supplements in
 * the group render unchanged so the user sees the full category in
 * context. Highlighting (handled by the rendering layer) shows only
 * the actual matches.
 *
 * Search haystack per supplement: `name`, `brand`, `recommendation`,
 * `rationale` (Q-lock from P-22 design).
 *
 * Empty / whitespace-only query passes through unchanged.
 *
 * `matchCount` counts retained groups (not individual cell matches);
 * sufficient for the "X von Y Kategorien" header counter. Cell-level
 * counting + Browser-Find Up/Down nav lives in P-22c-polish if a
 * real use case surfaces.
 */
export function filterSupplements(
  groups: LabeledSupplementGroup[],
  options: FilterSupplementsOptions = {},
): FilterSupplementsResult {
  const query = options.query ?? '';
  const totalCount = groups.length;

  const trimmed = query.trim();
  const terms =
    trimmed === ''
      ? []
      : trimmed
          .split(/\s+/)
          .map(normalizeForSearch)
          .filter((t) => t.length > 0);

  if (terms.length === 0) {
    return { groups, matchCount: totalCount, totalCount };
  }

  const matched = groups.filter((group) => groupMatches(group, terms));
  return { groups: matched, matchCount: matched.length, totalCount };
}

function groupMatches(group: LabeledSupplementGroup, terms: string[]): boolean {
  // Single haystack covering the translated label + every supplement
  // field. AND-combine terms so a multi-token query like "Vitamin
  // täglich" can match a vitamin supplement that lives in the
  // "Täglich" category, with each token landing in a different
  // field.
  const parts: string[] = [group.label];
  for (const s of group.supplements) {
    parts.push(s.name);
    if (s.brand) parts.push(s.brand);
    if (s.recommendation) parts.push(s.recommendation);
    if (s.rationale) parts.push(s.rationale);
  }
  const haystack = parts.map(normalizeForSearch).join('\n');
  return terms.every((term) => haystack.includes(term));
}
