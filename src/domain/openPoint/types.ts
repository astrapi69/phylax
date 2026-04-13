import type { DomainEntity } from '../../db/repositories/encryptedRepository';

/**
 * Open point context is free text grouping.
 *
 * Real profiles use descriptive context labels like:
 * - "Wiederholungs-Blutabnahme"
 * - "Beim naechsten Arztbesuch"
 * - "Dermatologen-Termin"
 * - "Laufend beobachten"
 *
 * Not an enum because the groupings are user-defined.
 */
export type OpenPointContext = string;

/**
 * A checklist item for follow-up actions.
 *
 * Grouped by context (doctor visit, lab repeat, ongoing monitoring).
 * Each item can be resolved (checked off) when addressed.
 */
export interface OpenPoint extends DomainEntity {
  /** The action or question text */
  text: string;
  /** Grouping context, e.g. "Beim naechsten Arztbesuch" */
  context: OpenPointContext;
  /** Whether this point has been addressed */
  resolved: boolean;
  /** Optional priority indicator */
  priority?: string;
  /** Optional time horizon, e.g. "Innerhalb 3 Monate" */
  timeHorizon?: string;
  /** Optional additional details or sub-items */
  details?: string;
}
