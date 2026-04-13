import type { DomainEntity } from '../../db/repositories/encryptedRepository';

/**
 * Observation status is free text, not an enum.
 *
 * Real profiles use descriptive phrases like:
 * - "Chronisch-rezidivierend"
 * - "Schwankend"
 * - "Offen, Termin ausstehend"
 * - "Abklingend"
 * - "Wiederkehrend, nicht chronisch"
 * - "Ueberwiegend stabil, situationsabhaengig symptomatisch"
 *
 * An enum would force awkward categorization. Free text is honest.
 */
export type ObservationStatus = string;

/**
 * Content provenance. Tracks who originated the content.
 *
 * - 'user': self-observation by the profile owner or caregiver
 * - 'ai': generated or suggested by an AI assistant
 * - 'medical': quoted from a doctor, lab report, or medical professional
 *
 * Currently tracked at the observation level (B1 strategy).
 * May evolve to per-field provenance when AI features land in DP-06.
 */
export type Source = 'user' | 'ai' | 'medical';

/**
 * A health observation with the three-facet structure:
 * fact, pattern, self-regulation.
 *
 * Observations are grouped by theme (e.g., "Schulter", "Ernaehrung",
 * "Blutdruck") and carry a free-text status.
 *
 * Hybrid field strategy (A3):
 * - Core triad (fact, pattern, selfRegulation) are typed fields
 * - Theme and status are typed (UI-critical for grouping and filtering)
 * - Medical finding and relevance notes are typed (semantically distinct)
 * - Everything else goes into extraSections with German keys
 */
export interface Observation extends DomainEntity {
  /** Grouping theme, e.g. "Schulter", "Ernaehrung", "Blutdruck" */
  theme: string;

  /**
   * What concretely happened or what the data shows. Free-form Markdown.
   * Can be a single sentence or a multi-line description with details.
   */
  fact: string;

  /**
   * What recurs: temporal, situational, or physiological patterns.
   * Free-form Markdown content.
   */
  pattern: string;

  /**
   * Self-regulation measures. Free-form Markdown content.
   * Can be a single sentence or a structured Markdown list with
   * bullet points, sub-sections, and nested details. The domain
   * model does not enforce structure; the UI renders as Markdown.
   */
  selfRegulation: string;

  /** Free-text descriptive status phrase */
  status: ObservationStatus;

  /** Who originated this observation */
  source: Source;

  /**
   * Medical finding from a doctor or specialist, if present.
   * Semantically distinct from self-observation (fact field).
   */
  medicalFinding?: string;

  /**
   * Cross-theme relevance notes, e.g. "Relevanz fuer Abnehmziel".
   * Links this observation to other health concerns.
   */
  relevanceNotes?: string;

  /**
   * Variable interpretive sections with German keys preserved verbatim.
   * Examples: "Ursprung", "Kausalitaetskette", "Sekundaere Ursache",
   * "Vorgeschichte", "Einschaetzung", "Zusammenfassung Kausalitaetskette".
   *
   * The domain model does not type these individually because they vary
   * too much across observations. Markdown content in values.
   */
  extraSections: Record<string, string>;
}
