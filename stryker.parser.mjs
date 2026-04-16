import { strykerBase, STRYKER_EXCLUDES } from './stryker.config.mjs';

/**
 * Per-module config: parser (src/features/profile-import/parser).
 * Threshold: 55.
 *
 * Parser has a high survivor count (280 in T-04f baseline) because:
 * - Section parsers are tested via a single fixture file (integration
 *   style), so edge-case branches are not exercised.
 * - 56% of survivors are regex/string mutations (anchor removals,
 *   quantifier changes) that are equivalent for the fixture's input.
 *
 * Sample triage (30 survivors): ~25% Category A (quick test additions),
 * ~45% Category B (equivalent for current input), ~30% Category C
 * (real but needs new dedicated edge-case fixtures). Dedicated parser
 * test hardening is deferred to a future task.
 */
export default {
  ...strykerBase,
  mutate: ['src/features/profile-import/parser/**/*.ts', ...STRYKER_EXCLUDES],
  thresholds: { high: 75, low: 60, break: 55 },
};
