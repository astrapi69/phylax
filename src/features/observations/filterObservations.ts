import type { Observation } from '../../domain';
import { isDateRangeActive, isInDateRangeEpoch, normalizeForSearch, type DateRange } from '../../lib';
import type { ThemeGroup } from './useObservations';

/**
 * Filter theme groups by an optional search query against the three
 * required content fields (theme, fact, pattern) AND an optional date
 * range applied to `createdAt`. Scope locked by ROADMAP O-17 line for
 * the search side: not selfRegulation, not medicalFinding, not
 * relevanceNotes.
 *
 * Multi-term semantics: query is split on whitespace and ALL terms
 * must match (AND). Each term must appear, in normalized form, in at
 * least one of the three searched fields. The date range applies in
 * conjunction with the search (logical AND) so an observation must
 * satisfy both filters to remain in the result.
 *
 * Match metadata: returns the post-filter groups and the total count
 * of matching observations. Counts are computed from filtered groups,
 * not from raw input, so the (matches/total) header reflects what is
 * actually visible.
 *
 * Empty / whitespace-only query AND empty date range return groups
 * unchanged (caller treats this as "no filter active"). Either filter
 * being active narrows the result.
 */
export interface FilterResult {
  groups: ThemeGroup[];
  matchCount: number;
  totalCount: number;
}

export interface FilterObservationsOptions {
  query?: string;
  dateRange?: DateRange;
}

export function filterObservations(
  groups: ThemeGroup[],
  queryOrOptions: string | FilterObservationsOptions = '',
): FilterResult {
  const options: FilterObservationsOptions =
    typeof queryOrOptions === 'string' ? { query: queryOrOptions } : queryOrOptions;
  const query = options.query ?? '';
  const dateRange = options.dateRange ?? {};
  const dateActive = isDateRangeActive(dateRange);

  const totalCount = groups.reduce((sum, g) => sum + g.observations.length, 0);

  const trimmed = query.trim();
  const terms =
    trimmed === ''
      ? []
      : trimmed
          .split(/\s+/)
          .map(normalizeForSearch)
          .filter((t) => t.length > 0);

  // No filters active at all: pass everything through unchanged.
  if (terms.length === 0 && !dateActive) {
    return { groups, matchCount: totalCount, totalCount };
  }

  let matchCount = 0;
  const filteredGroups: ThemeGroup[] = [];

  for (const group of groups) {
    const matchingObservations = group.observations.filter((obs) => {
      if (dateActive && !isInDateRangeEpoch(obs.createdAt, dateRange)) return false;
      if (terms.length > 0 && !matchesTerms(obs, terms)) return false;
      return true;
    });
    if (matchingObservations.length > 0) {
      filteredGroups.push({ theme: group.theme, observations: matchingObservations });
      matchCount += matchingObservations.length;
    }
  }

  return { groups: filteredGroups, matchCount, totalCount };
}

function matchesTerms(obs: Observation, terms: string[]): boolean {
  const haystack = [obs.theme, obs.fact, obs.pattern].map(normalizeForSearch).join('\n');
  return terms.every((term) => haystack.includes(term));
}
