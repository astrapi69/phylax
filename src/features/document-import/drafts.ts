import type { Observation, LabValue, Supplement, OpenPoint } from '../../domain';

/**
 * Draft types for AI-extracted entries (Phase 4b IMP-03).
 *
 * Each draft is a `Pick` of the domain type's user-facing fields,
 * intentionally omitting infrastructure (id, profileId, createdAt,
 * updatedAt). Type-coupling to the domain types is a feature, not
 * a bug: if a domain type changes, drafts break loudly at the type
 * layer, surfacing the gap at compile time rather than silently at
 * commit time.
 *
 * Drafts are NOT persisted by IMP-03. They flow into the IMP-04
 * review UI, get edited / discarded / accepted by the user, and
 * the accepted ones are committed via the existing repository
 * `create()` path. The `id`, `profileId`, `createdAt`, and
 * `updatedAt` fields are populated at commit time.
 */

/**
 * Observation draft. `source` is hardcoded to `'ai'` so commits
 * downstream can attribute provenance back to AI extraction
 * (matching AI-08's chat-commit pattern; not a new enum value to
 * avoid drift).
 *
 * `extraSections` defaults to `{}` at extraction time; the AI tool
 * schema does not currently expose it. IMP-06 may refine.
 */
export type ObservationDraft = Pick<
  Observation,
  'theme' | 'fact' | 'pattern' | 'selfRegulation' | 'status' | 'medicalFinding' | 'relevanceNotes'
> & {
  source: 'ai';
  extraSections: Record<string, string>;
};

/**
 * Lab value draft. `reportId` is omitted because IMP-03 does not
 * yet create LabReport rows — IMP-04 commit may either map drafts
 * to an existing report or surface a new-report flow. `result` is
 * a string per the domain (lab values can be non-numeric).
 */
export type LabValueDraft = Pick<
  LabValue,
  'category' | 'parameter' | 'result' | 'unit' | 'referenceRange' | 'assessment'
>;

/** Supplement draft. */
export type SupplementDraft = Pick<
  Supplement,
  'name' | 'brand' | 'category' | 'recommendation' | 'rationale'
>;

/**
 * Open-point draft. `resolved` defaults to false (a freshly
 * extracted action item is open by definition).
 */
export type OpenPointDraft = Pick<
  OpenPoint,
  'text' | 'context' | 'priority' | 'timeHorizon' | 'details'
> & {
  resolved: false;
};

/**
 * Document-level metadata returned by the lab-values extractor (IMP-04).
 *
 * Lab values are FK-bound to a `LabReport` in the domain model. The
 * AI extractor surfaces report-date and lab-name when the source
 * document makes them explicit (most lab reports do). The IMP-04
 * commit pipeline uses these to synthesize a `LabReport` row that
 * the accepted lab values reference.
 *
 * Both fields are optional — the AI returns them only when the
 * document is unambiguous. On commit:
 * - `reportDate` missing or unparseable → fall back to today's ISO date.
 * - `labName` missing → leave the synthetic report's `labName` undefined.
 */
export interface LabReportMeta {
  /** ISO date (YYYY-MM-DD) extracted from the document, if unambiguous. */
  reportDate?: string;
  /** Lab name extracted from the document, if explicitly present. */
  labName?: string;
}

/**
 * Aggregate result of `extractEntries(input, classification)`. Each
 * draft array is (possibly empty). Empty arrays are valid: a doctor
 * letter with no actionable items returns `openPoints: []`.
 *
 * `labReportMeta` carries document-level fields needed to synthesize
 * the parent `LabReport` at commit time. Always present; fields
 * within may be absent when the AI could not extract them.
 */
export interface ExtractedDrafts {
  observations: ObservationDraft[];
  labValues: LabValueDraft[];
  supplements: SupplementDraft[];
  openPoints: OpenPointDraft[];
  labReportMeta: LabReportMeta;
}

/** Empty drafts aggregate; used when classification short-circuits. */
export const EMPTY_DRAFTS: ExtractedDrafts = {
  observations: [],
  labValues: [],
  supplements: [],
  openPoints: [],
  labReportMeta: {},
};
