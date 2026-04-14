/**
 * Known accessibility exclusions for the smoke suite.
 *
 * Entries are skipped by the axe runner in `assertNoA11yViolations`. Every
 * entry must carry a written justification so future reviewers understand
 * why it was added and can revisit it.
 *
 * Policy:
 * 1. Prefer fixing the source over adding an exclusion.
 * 2. Add an exclusion only when the violation is a false positive, a known
 *    third-party limitation, or a deliberate design tradeoff.
 * 3. Review the list periodically. Remove entries whose rationale no longer
 *    holds as the UI evolves.
 */

export interface A11yExclusion {
  /** axe rule id, e.g. 'color-contrast'. */
  rule: string;
  /** Optional CSS selector to scope the exclusion to a subtree. */
  selector?: string;
  /** Short prose explanation of why this exclusion exists. */
  reason: string;
  /** Optional route or screen label for filtering and review. */
  screen?: string;
  /** ISO date the exclusion was added. Used for periodic review. */
  addedAt: string;
}

export const A11Y_EXCLUSIONS: A11yExclusion[] = [];
