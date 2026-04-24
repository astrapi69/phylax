import type { DomainEntity } from '../../db/repositories/encryptedRepository';

/**
 * A lab report containing multiple lab values.
 *
 * Represents a single lab visit or blood draw event. Groups values
 * by category (Blutbild, Nierenwerte, etc.) and carries per-category
 * assessments as a map with German keys.
 */
export interface LabReport extends DomainEntity {
  /** ISO date of the lab report */
  reportDate: string;
  /** Laboratory name, e.g. "Synlab" */
  labName?: string;
  /** Referring or ordering doctor */
  doctorName?: string;
  /** Lab report number or identifier */
  reportNumber?: string;
  /** Context for the report, e.g. "Routinekontrolle, Ueberweisung vom Hausarzt" */
  contextNote?: string;
  /**
   * Per-category textual assessments.
   * German keys: "Blutbild", "Nierenwerte", "Stoffwechsel", "Lipide",
   * "Leberwerte", "Schilddruese", "Infektionsserologie", etc.
   * Values are Markdown assessment text.
   */
  categoryAssessments: Record<string, string>;
  /** Overall assessment across all categories */
  overallAssessment?: string;
  /** Cross-theme relevance, e.g. "Relevanz fuer Abnehmziel" */
  relevanceNotes?: string;

  /**
   * Import provenance (IMP-05). Points to a `Document` saved during
   * an IMP-04 import commit as the source of this report (when the
   * report was synthesized from an imported file). Cleared to
   * `undefined` when the source Document is deleted; the report and
   * its lab values survive.
   */
  sourceDocumentId?: string;
}

/**
 * A single lab measurement within a lab report.
 *
 * Flat entity with reportId FK to LabReport (D1 strategy).
 * This enables cross-report queries like "all Kreatinin values over time"
 * without loading all reports.
 *
 * Result is a string, not a number, because lab values can be
 * non-numeric: ">100", "negativ", "1:40", "<0.5".
 */
export interface LabValue extends DomainEntity {
  /** FK to the parent LabReport */
  reportId: string;
  /** Category within the report: "Blutbild", "Nierenwerte", etc. */
  category: string;
  /** Parameter name: "Haemoglobin", "Kreatinin", "TSH", etc. */
  parameter: string;
  /** Result value as string to preserve formatting and non-numeric values */
  result: string;
  /** Unit of measurement: "g/dl", "mg/dl", "mU/l", etc. */
  unit?: string;
  /** Reference range: "13.5-17.5", "0.27-4.20", etc. */
  referenceRange?: string;
  /** Assessment: "normal", "erniedrigt", "erhoht", or free text */
  assessment?: string;

  /**
   * Import provenance (IMP-05). Same semantics as on `Observation`.
   */
  sourceDocumentId?: string;
}
