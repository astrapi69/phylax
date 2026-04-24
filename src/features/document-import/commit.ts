import {
  DocumentRepository,
  DocumentSizeLimitError,
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
  /**
   * Outcome of the IMP-05 source-Document save step. Discriminated:
   * - `saved`: the source file became a Document row; accepted
   *   entities got `sourceDocumentId` set to this id.
   * - `skipped`: save failed (size, quota, crypto, unknown). Entities
   *   still commit but without `sourceDocumentId`. The import is NOT
   *   aborted on this path.
   * - `not-applicable`: caller did not supply a source File (batch
   *   import, legacy caller, tests).
   */
  sourceDocument: SourceDocumentOutcome;
}

/** IMP-05 source-Document save outcome. */
export type SourceDocumentOutcome =
  | { kind: 'saved'; documentId: string; filename: string }
  | { kind: 'skipped'; reason: SourceDocumentSkipReason }
  | { kind: 'not-applicable' };

export type SourceDocumentSkipReason = 'size-limit' | 'quota' | 'encryption-failed' | 'unknown';

export interface CommitOptions {
  /** Source filename used to seed the synthetic lab report's `contextNote`. */
  sourceFileName: string;
  /**
   * Source File to save as a Document (IMP-05). When present, the
   * pipeline saves it first and threads the resulting documentId to
   * every accepted entity as `sourceDocumentId`. When omitted,
   * `sourceDocument` in the result is `not-applicable`.
   *
   * Best-effort: a failed Document save surfaces as
   * `{ kind: 'skipped', reason }` and does NOT abort the commit.
   * Entities still land; they simply miss the provenance link.
   */
  sourceFile?: File;
  /**
   * Human-readable description saved on the Document row. Defaults
   * to `"Importiert"` when omitted. Callers (useImportSession) build
   * a type-specific label like `"Importiert: Laborbefund"` via the
   * i18n surface.
   */
  documentDescription?: string;
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
    document?: DocumentRepository;
  };
}

/**
 * Commit selected drafts to the encrypted repositories.
 *
 * Pipeline:
 * 1. Resolve current profile (precondition; `no-profile` aborts).
 * 2. (IMP-05) When a `sourceFile` is supplied, save it as a Document
 *    first. Best-effort: failures don't abort, they surface as
 *    `sourceDocument: { kind: 'skipped', reason }`. On success every
 *    entity created below gets `sourceDocumentId` set to the new id.
 * 3. Observations → ObservationRepository.create per accepted draft.
 * 4. If lab values selected, synthesize a LabReport (using
 *    `labReportMeta.reportDate` if present, today's ISO date
 *    otherwise; `labName` from meta when present), then write each
 *    lab value with `reportId` set to the synthetic report's id.
 *    The synthetic report inherits `sourceDocumentId` too so its
 *    provenance matches the derived values.
 * 5. Supplements → SupplementRepository.create per accepted draft.
 * 6. Open points → OpenPointRepository.create per accepted draft.
 * 7. (IMP-05 cleanup-if-zero) If every entity type committed zero
 *    rows and we had saved a Document, delete the orphan Document
 *    so it doesn't confuse the user in the Documents list.
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
    document: options.repos?.document ?? new DocumentRepository(),
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
    sourceDocument: { kind: 'not-applicable' },
  };

  const profile = await repos.profile.getCurrentProfile();
  if (!profile) {
    result.abortError = 'no-profile';
    return result;
  }
  const profileId = profile.id;

  // IMP-05: save source Document first so sourceDocumentId can flow
  // into every entity create below. Best-effort; failures don't abort.
  let sourceDocumentId: string | undefined;
  if (options.sourceFile) {
    const saveResult = await saveSourceDocument({
      file: options.sourceFile,
      profileId,
      description: options.documentDescription,
      repo: repos.document,
    });
    result.sourceDocument = saveResult;
    if (saveResult.kind === 'saved') {
      sourceDocumentId = saveResult.documentId;
    }
  }

  // 1. Observations
  const acceptedObservations = pickAccepted(drafts.observations, selection.observations);
  result.observations.attempted = acceptedObservations.length;
  for (const draft of acceptedObservations) {
    try {
      await repos.observation.create(observationCreateInput(draft, profileId, sourceDocumentId));
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
        sourceDocumentId,
      );
      const report = await repos.labReport.create(reportInput);
      result.labReportId = report.id;
      for (const draft of acceptedLabValues) {
        try {
          await repos.labValue.create(
            labValueCreateInput(draft, profileId, report.id, sourceDocumentId),
          );
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
      await repos.supplement.create(supplementCreateInput(draft, profileId, sourceDocumentId));
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
      await repos.openPoint.create(openPointCreateInput(draft, profileId, sourceDocumentId));
      result.openPoints.succeeded += 1;
    } catch {
      result.openPoints.failed += 1;
    }
  }

  // IMP-05 cleanup-if-zero: if nothing landed and we had saved a
  // Document, delete the orphan so it doesn't surface in the
  // Documents list with no derived entries.
  if (result.sourceDocument.kind === 'saved' && totalCommitted(result) === 0) {
    try {
      await repos.document.delete(result.sourceDocument.documentId);
    } catch {
      // Silently ignore — the orphan survives but is visible to the user
      // who can delete it manually via D-08.
    }
    result.sourceDocument = { kind: 'skipped', reason: 'unknown' };
  }

  return result;
}

interface SaveSourceDocumentArgs {
  file: File;
  profileId: string;
  description: string | undefined;
  repo: DocumentRepository;
}

async function saveSourceDocument(args: SaveSourceDocumentArgs): Promise<SourceDocumentOutcome> {
  try {
    const content = await args.file.arrayBuffer();
    const document = await args.repo.create({
      profileId: args.profileId,
      filename: args.file.name,
      mimeType: args.file.type || 'application/octet-stream',
      sizeBytes: args.file.size,
      description: args.description ?? 'Importiert',
      content,
    });
    return {
      kind: 'saved',
      documentId: document.id,
      filename: document.filename,
    };
  } catch (err) {
    return {
      kind: 'skipped',
      reason: classifySaveError(err),
    };
  }
}

function classifySaveError(err: unknown): SourceDocumentSkipReason {
  if (err instanceof DocumentSizeLimitError) return 'size-limit';
  if (err instanceof DOMException) {
    if (err.name === 'QuotaExceededError') return 'quota';
    if (err.name === 'DataCloneError' || err.name === 'OperationError') {
      return 'encryption-failed';
    }
  }
  return 'unknown';
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
  sourceDocumentId: string | undefined,
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
    sourceDocumentId,
  };
}

function labReportCreateInput(
  meta: LabReportMeta,
  profileId: string,
  sourceFileName: string,
  now: Date,
  sourceDocumentId: string | undefined,
): Omit<LabReport, 'id' | 'createdAt' | 'updatedAt'> {
  const reportDate = meta.reportDate ?? toIsoDate(now);
  return {
    profileId,
    reportDate,
    labName: meta.labName,
    contextNote: `Importiert aus ${sourceFileName}`,
    categoryAssessments: {},
    sourceDocumentId,
  };
}

function labValueCreateInput(
  draft: LabValueDraft,
  profileId: string,
  reportId: string,
  sourceDocumentId: string | undefined,
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
    sourceDocumentId,
  };
}

function supplementCreateInput(
  draft: SupplementDraft,
  profileId: string,
  sourceDocumentId: string | undefined,
): Omit<Supplement, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId,
    name: draft.name,
    brand: draft.brand,
    category: draft.category,
    recommendation: draft.recommendation,
    rationale: draft.rationale,
    sourceDocumentId,
  };
}

function openPointCreateInput(
  draft: OpenPointDraft,
  profileId: string,
  sourceDocumentId: string | undefined,
): Omit<OpenPoint, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId,
    text: draft.text,
    context: draft.context,
    resolved: draft.resolved,
    priority: draft.priority,
    timeHorizon: draft.timeHorizon,
    details: draft.details,
    sourceDocumentId,
  };
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
