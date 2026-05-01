export { normalizeForSearch } from './normalizeForSearch';
export { findMatchRanges, splitQuery, type MatchRange } from './searchMatches';
export {
  parseDateBound,
  parseDateRange,
  isInDateRangeEpoch,
  isInDateRangeIso,
  isDateRangeActive,
  type DateRange,
} from './dateRangeFilter';
export { useUrlSearchParam } from './useUrlSearchParam';
export { prefersReducedMotion, preferredScrollBehavior } from './prefersReducedMotion';
export { useActiveMatch, type UseActiveMatchResult } from './useActiveMatch';
export {
  buildFieldMatchPlan,
  type FieldEntry,
  type FieldMatch,
  type MatchPlan,
  type BuildFieldMatchPlanResult,
} from './buildFieldMatchPlan';
