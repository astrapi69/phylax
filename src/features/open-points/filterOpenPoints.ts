import { normalizeForSearch } from '../../lib';
import type { ContextGroup } from './useOpenPoints';

export interface FilterOpenPointsOptions {
  query?: string;
}

export interface FilterOpenPointsResult {
  groups: ContextGroup[];
  matchCount: number;
  totalCount: number;
}

/**
 * Filter open-point context groups by an optional search query
 * whose terms must all match (AND across whitespace-split terms).
 *
 * Group-keep semantic (mirrors Observations theme group +
 * Supplements category group): a context group is retained when
 * EITHER its `context` label matches the query OR any of its
 * items matches. When retained, ALL items in the group render
 * unchanged so the user sees the full group in context.
 * Highlighting (handled by the rendering layer) shows only the
 * actual matches.
 *
 * Search haystack per item: `text`, `priority`, `timeHorizon`,
 * `details`, plus the group `context` label. P-22d Q-lock keeps
 * the haystack identical to the visible card surface so a token
 * the user sees can match.
 *
 * Empty / whitespace-only query passes through unchanged.
 *
 * `matchCount` counts retained groups (not individual cell
 * matches); sufficient for the "X von Y Kontexten" header
 * counter. Cell-level counting + Browser-Find Up/Down nav lives
 * in P-22d-polish if a real use case surfaces.
 */
export function filterOpenPoints(
  groups: ContextGroup[],
  options: FilterOpenPointsOptions = {},
): FilterOpenPointsResult {
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

function groupMatches(group: ContextGroup, terms: string[]): boolean {
  // Single haystack covering the context label + every item field.
  // AND-combine terms so a multi-token query like "Arzt blut" can
  // match an item under "Arztbesuch" mentioning "Blutabnahme",
  // with each token in a different field.
  const parts: string[] = [group.context];
  for (const item of group.items) {
    parts.push(item.text);
    if (item.priority) parts.push(item.priority);
    if (item.timeHorizon) parts.push(item.timeHorizon);
    if (item.details) parts.push(item.details);
  }
  const haystack = parts.map(normalizeForSearch).join('\n');
  return terms.every((term) => haystack.includes(term));
}
