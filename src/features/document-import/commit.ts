import {
  LabReportRepository,
  LabValueRepository,
  ObservationRepository,
  OpenPointRepository,
  ProfileRepository,
  SupplementRepository,
} from '../../db/repositories';
import type { Observation, OpenPoint, Supplement, LabReport, LabValue } from '../../domain';
import type {
  ExtractedDrafts,
  LabReportMeta,
  LabValueDraft,
  ObservationDraft,
  OpenPointDraft,
  SupplementDraft,
} from './drafts';

/**
 * Per-draft selection map. The IMP-04 review UI tracks which drafts
 * the user accepted; arrays of indices into the corresponding
 * `ExtractedDrafts` arrays. Unspecified arrays default to "none
 * accepted" (safer than "all accepted" — explicit opt-in matches
 * the local-first principle).
 */
export interface DraftSelection {
  observations: number[];
  labValues: number[];
  supplements: number[];
  openPoints: number[];
}

/** Per-type write tally with collected failure detail for telemetry. */
export interface CommitTypeResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/**
 * Aggregate result of `commitDrafts`. Best-effort: a failure in one
 * type does not abort the others. The pipeline writes in a
 * deterministic order — observations → labValues → supplements →
 * openPoints — so partial-success states are interpretable to the
 * user ("3 observations, 2 lab values; supplements not reached").
 *
 * `labReportId` is set when ≥1 lab value was selected: the synthetic
 * `LabReport` row that values reference. Null when no lab values
 * were committed (no parent report needed).
 */
export interface CommitResult {
  observations: CommitTypeResult;
  labValues: CommitTypeResult;
  supplements: CommitTypeResult;
  openPoints: CommitTypeResult;
  labReportId: string | null;
  /**
   * First fatal error that aborted the pipeline before completion.
   * `null` when every type was attempted (even if some individual
   * writes failed; those are counted in `failed`).
   *
   * Currently only set when no profile exists (precondition failure).
   */
  abortError: 'no-profile' | null;
}

export interface CommitOptions {
  /** Source filename used to seed the synthetic lab report's `contextNote`. */
  sourceFileName: string;
  /**
   * Override `Date.now` for the synthetic-report fallback date. Tests
   * pin time so the fallback path is deterministic.
   */
  now?: () => Date;
  /** Repository overrides for unit tests. Production uses defaults. */
  repos?: {
    profile?: ProfileRepository;
    observation?: ObservationRepository;
    labReport?: LabReportRepository;
    labValue?: LabValueRepository;
    supplement?: SupplementRepository;
    openPoint?: OpenPointRepository;
  };
}

/**
 * Commit selected drafts to the encrypted repositories.
 *
 * Pipeline:
 * 1. Resolve current profile (precondition).
 * 2. Observations → ObservationRepository.create per accepted draft.
 * 3. If lab values selected, synthesize a LabReport (using
 *    `labReportMeta.reportDate` if present, today's ISO date
 *    otherwise; `labName` from meta when present), then write each
 *    lab value with `reportId` set to the synthetic report's id.
 * 4. Supplements → SupplementRepository.create per accepted draft.
 * 5. Open points → OpenPointRepository.create per accepted draft.
 *
 * Best-effort within each type: per-write failures are tallied,
 * not raised. Cross-type pipeline aborts only on missing profile.
 * AbortSignal is intentionally not threaded through — writes are
 * fast (encryption per record, single-table puts) and a partial
 * commit must finish what it started rather than half-write a type.
 */
export async function commitDrafts(
  drafts: ExtractedDrafts,
  selection: DraftSelection,
  options: CommitOptions,
): Promise<CommitResult> {
  const labValueRepo = options.repos?.labValue ?? new LabValueRepository();
  const repos = {
    profile: options.repos?.profile ?? new ProfileRepository(),
    observation: options.repos?.observation ?? new ObservationRepository(),
    labReport: options.repos?.labReport ?? new LabReportRepository(labValueRepo),
    labValue: labValueRepo,
    supplement: options.repos?.supplement ?? new SupplementRepository(),
    openPoint: options.repos?.openPoint ?? new OpenPointRepository(),
  };
  const now = options.now ?? (() => new Date());

  const empty: CommitTypeResult = { attempted: 0, succeeded: 0, failed: 0 };
  const result: CommitResult = {
    observations: { ...empty },
    labValues: { ...empty },
    supplements: { ...empty },
    openPoints: { ...empty },
    labReportId: null,
    abortError: null,
  };

  const profile = await repos.profile.getCurrentProfile();
  if (!profile) {
    result.abortError = 'no-profile';
    return result;
  }
  const profileId = profile.id;

  // 1. Observations
  const acceptedObservations = pickAccepted(drafts.observations, selection.observations);
  result.observations.attempted = acceptedObservations.length;
  for (const draft of acceptedObservations) {
    try {
      await repos.observation.create(observationCreateInput(draft, profileId));
      result.observations.succeeded += 1;
    } catch {
      result.observations.failed += 1;
    }
  }

  // 2. Lab values (with synthetic LabReport)
  const acceptedLabValues = pickAccepted(drafts.labValues, selection.labValues);
  if (acceptedLabValues.length > 0) {
    result.labValues.attempted = acceptedLabValues.length;
    try {
      const reportInput = labReportCreateInput(
        drafts.labReportMeta,
        profileId,
        options.sourceFileName,
        now(),
      );
      const report = await repos.labReport.create(reportInput);
      result.labReportId = report.id;
      for (const draft of acceptedLabValues) {
        try {
          await repos.labValue.create(labValueCreateInput(draft, profileId, report.id));
          result.labValues.succeeded += 1;
        } catch {
          result.labValues.failed += 1;
        }
      }
    } catch {
      // Synthesizing the parent report failed; every selected value is counted as failed.
      result.labValues.failed = acceptedLabValues.length;
    }
  }

  // 3. Supplements
  const acceptedSupplements = pickAccepted(drafts.supplements, selection.supplements);
  result.supplements.attempted = acceptedSupplements.length;
  for (const draft of acceptedSupplements) {
    try {
      await repos.supplement.create(supplementCreateInput(draft, profileId));
      result.supplements.succeeded += 1;
    } catch {
      result.supplements.failed += 1;
    }
  }

  // 4. Open points
  const acceptedOpenPoints = pickAccepted(drafts.openPoints, selection.openPoints);
  result.openPoints.attempted = acceptedOpenPoints.length;
  for (const draft of acceptedOpenPoints) {
    try {
      await repos.openPoint.create(openPointCreateInput(draft, profileId));
      result.openPoints.succeeded += 1;
    } catch {
      result.openPoints.failed += 1;
    }
  }

  return result;
}

/** True when the selection map has no accepted drafts of any type. */
export function isSelectionEmpty(selection: DraftSelection): boolean {
  return (
    selection.observations.length === 0 &&
    selection.labValues.length === 0 &&
    selection.supplements.length === 0 &&
    selection.openPoints.length === 0
  );
}

/** Total successful writes across all types. */
export function totalCommitted(result: CommitResult): number {
  return (
    result.observations.succeeded +
    result.labValues.succeeded +
    result.supplements.succeeded +
    result.openPoints.succeeded
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function pickAccepted<T>(drafts: readonly T[], indices: readonly number[]): T[] {
  const accepted: T[] = [];
  for (const idx of indices) {
    const draft = drafts[idx];
    if (draft !== undefined) accepted.push(draft);
  }
  return accepted;
}

function observationCreateInput(
  draft: ObservationDraft,
  profileId: string,
): Omit<Observation, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId,
    theme: draft.theme,
    fact: draft.fact,
    pattern: draft.pattern,
    selfRegulation: draft.selfRegulation,
    status: draft.status,
    source: draft.source,
    medicalFinding: draft.medicalFinding,
    relevanceNotes: draft.relevanceNotes,
    extraSections: draft.extraSections,
  };
}

function labReportCreateInput(
  meta: LabReportMeta,
  profileId: string,
  sourceFileName: string,
  now: Date,
): Omit<LabReport, 'id' | 'createdAt' | 'updatedAt'> {
  const reportDate = meta.reportDate ?? toIsoDate(now);
  return {
    profileId,
    reportDate,
    labName: meta.labName,
    contextNote: `Importiert aus ${sourceFileName}`,
    categoryAssessments: {},
  };
}

function labValueCreateInput(
  draft: LabValueDraft,
  profileId: string,
  reportId: string,
): Omit<LabValue, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId,
    reportId,
    category: draft.category,
    parameter: draft.parameter,
    result: draft.result,
    unit: draft.unit,
    referenceRange: draft.referenceRange,
    assessment: draft.assessment,
  };
}

function supplementCreateInput(
  draft: SupplementDraft,
  profileId: string,
): Omit<Supplement, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId,
    name: draft.name,
    brand: draft.brand,
    category: draft.category,
    recommendation: draft.recommendation,
    rationale: draft.rationale,
  };
}

function openPointCreateInput(
  draft: OpenPointDraft,
  profileId: string,
): Omit<OpenPoint, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId,
    text: draft.text,
    context: draft.context,
    resolved: draft.resolved,
    priority: draft.priority,
    timeHorizon: draft.timeHorizon,
    details: draft.details,
  };
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
