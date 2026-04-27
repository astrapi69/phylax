import type { Observation } from '../../domain';
import { normalizeForSearch } from '../../lib';
import type { ThemeGroup } from './useObservations';

/**
 * Filter theme groups by a search query against the three required
 * content fields (theme, fact, pattern). Scope locked by ROADMAP O-17
 * line: not selfRegulation, not medicalFinding, not relevanceNotes.
 *
 * Multi-term semantics: query is split on whitespace and ALL terms
 * must match (AND). Each term must appear, in normalized form, in at
 * least one of the three searched fields. A theme group is kept if
 * at least one of its observations matches; the group's observations
 * list is filtered down to only matching observations.
 *
 * Match metadata: returns the post-filter groups and the total count
 * of matching observations. Counts are computed from filtered groups,
 * not from raw input, so the (matches/total) header reflects what is
 * actually visible.
 *
 * Empty / whitespace-only query returns groups unchanged with the
 * total observation count (caller treats this as "no filter active").
 */
export interface FilterResult {
  groups: ThemeGroup[];
  matchCount: number;
  totalCount: number;
}

export function filterObservations(groups: ThemeGroup[], query: string): FilterResult {
  const totalCount = groups.reduce((sum, g) => sum + g.observations.length, 0);
  const trimmed = query.trim();
  if (trimmed === '') {
    return { groups, matchCount: totalCount, totalCount };
  }

  const terms = trimmed
    .split(/\s+/)
    .map(normalizeForSearch)
    .filter((t) => t.length > 0);

  if (terms.length === 0) {
    return { groups, matchCount: totalCount, totalCount };
  }

  let matchCount = 0;
  const filteredGroups: ThemeGroup[] = [];

  for (const group of groups) {
    const matchingObservations = group.observations.filter((obs) => matches(obs, terms));
    if (matchingObservations.length > 0) {
      filteredGroups.push({ theme: group.theme, observations: matchingObservations });
      matchCount += matchingObservations.length;
    }
  }

  return { groups: filteredGroups, matchCount, totalCount };
}

function matches(obs: Observation, terms: string[]): boolean {
  const haystack = [obs.theme, obs.fact, obs.pattern].map(normalizeForSearch).join('\n');
  return terms.every((term) => haystack.includes(term));
}
