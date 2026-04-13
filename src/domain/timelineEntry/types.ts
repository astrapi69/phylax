import type { DomainEntity } from '../../db/repositories/encryptedRepository';
import type { Source } from '../observation/types';

/**
 * A retrospective timeline entry (Verlaufsnotiz).
 *
 * Structurally different from Observations (C1 strategy):
 * - Date-bounded ("Dezember 2024", "Maerz 2026")
 * - Narrative (prose about what happened in that period)
 * - Retrospective (written after the fact, looking back)
 *
 * Observations are theme-bounded, structured (fact/pattern/selfRegulation),
 * and ongoing. Timeline entries capture specific time periods and events.
 */
export interface TimelineEntry extends DomainEntity {
  /** Time period label, e.g. "Dezember 2024", "Maerz 2026" */
  period: string;
  /** Summary title, e.g. "Brustkorbbeschwerden", "Gewichtszunahme und Abnehmplan" */
  title: string;
  /** Markdown content of the entry (bulleted notes, narrative) */
  content: string;
  /** Who authored this entry */
  source: Source;
}
