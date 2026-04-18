import type { ParseResult } from '../parser/types';

/**
 * Total number of parsed entities across all entity types. Used to
 * distinguish a genuinely useful partial parse from a near-empty one
 * that likely indicates a format mismatch.
 */
export function totalEntityCount(result: ParseResult): number {
  return (
    result.observations.length +
    result.labReports.length +
    result.labValues.length +
    result.supplements.length +
    result.openPoints.length +
    result.profileVersions.length +
    result.timelineEntries.length
  );
}

/**
 * True when the ParseResult contains nothing usable. Mirrors the rule
 * used by useImport before AI-09: no profile, no entities of any kind.
 */
export function isEmptyParseResult(result: ParseResult): boolean {
  return result.profile === null && totalEntityCount(result) === 0;
}

/**
 * AI-09 threshold: below this many extracted entities combined with at
 * least one parse warning, the result counts as a soft failure. Tuned
 * to avoid nagging users with mostly-good imports.
 */
export const LOW_ENTITY_THRESHOLD = 3;

/**
 * Decides whether the UI should offer AI-assisted cleanup for a parse
 * result. Two conditions trigger the offer:
 *
 * 1. The result is entirely empty (hard failure).
 * 2. Fewer than LOW_ENTITY_THRESHOLD entities were extracted AND the
 *    parser emitted warnings (soft failure, likely partial recognition).
 *
 * Well-formed imports with many entities never trigger the offer, even
 * if a few warnings are present. Well-formed imports with zero warnings
 * and few entities also pass through: the parser had nothing to warn
 * about, so the low count likely reflects a short but valid input.
 */
export function shouldOfferCleanup(result: ParseResult): boolean {
  if (isEmptyParseResult(result)) return true;
  const total = totalEntityCount(result);
  const hasWarnings = result.report.warnings.length > 0;
  return total < LOW_ENTITY_THRESHOLD && hasWarnings;
}
