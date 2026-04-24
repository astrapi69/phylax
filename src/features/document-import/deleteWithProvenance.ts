import {
  DocumentRepository,
  LabReportRepository,
  LabValueRepository,
  ObservationRepository,
  OpenPointRepository,
  SupplementRepository,
} from '../../db/repositories';

/**
 * Per-type counts of entities whose `sourceDocumentId` points at a
 * given Document. Surfaces in the D-08 delete-confirmation copy so
 * the user knows the blast radius before deleting.
 */
export interface DerivedEntityCounts {
  observations: number;
  labValues: number;
  labReports: number;
  supplements: number;
  openPoints: number;
  /** Sum across all types. 0 when the Document has no derived entities. */
  total: number;
}

export interface CountOptions {
  repos?: {
    observation?: ObservationRepository;
    labValue?: LabValueRepository;
    labReport?: LabReportRepository;
    supplement?: SupplementRepository;
    openPoint?: OpenPointRepository;
  };
}

/**
 * Count the entities (across all 5 types) whose `sourceDocumentId`
 * matches the given document id. Used by D-08 to show a cascade
 * warning before deletion.
 */
export async function countDerivedEntities(
  documentId: string,
  options: CountOptions = {},
): Promise<DerivedEntityCounts> {
  const repos = repoDefaults(options);
  const [obs, vals, rpts, supp, ops] = await Promise.all([
    repos.observation.listBySourceDocument(documentId),
    repos.labValue.listBySourceDocument(documentId),
    repos.labReport.listBySourceDocument(documentId),
    repos.supplement.listBySourceDocument(documentId),
    repos.openPoint.listBySourceDocument(documentId),
  ]);
  return {
    observations: obs.length,
    labValues: vals.length,
    labReports: rpts.length,
    supplements: supp.length,
    openPoints: ops.length,
    total: obs.length + vals.length + rpts.length + supp.length + ops.length,
  };
}

export interface DeleteWithProvenanceOptions extends CountOptions {
  repos?: CountOptions['repos'] & {
    document?: DocumentRepository;
  };
}

export type DeleteWithProvenanceResult =
  | { kind: 'ok' }
  | { kind: 'cleanup-failed'; error: unknown };

/**
 * Delete a Document and clear `sourceDocumentId` on every entity
 * (across all 5 types) that referenced it.
 *
 * Order matters: clear references first (so there is no transient
 * window where a zombie reference could mislead a reader), then
 * delete the Document itself. If clearing partially fails, we stop
 * and do NOT delete the Document — the user retries from a consistent
 * state rather than being left with a deleted Document and partially
 * updated entities.
 */
export async function deleteWithProvenance(
  documentId: string,
  options: DeleteWithProvenanceOptions = {},
): Promise<DeleteWithProvenanceResult> {
  const repos = repoDefaults(options);
  const docRepo = options.repos?.document ?? new DocumentRepository();

  try {
    const [obs, vals, rpts, supp, ops] = await Promise.all([
      repos.observation.listBySourceDocument(documentId),
      repos.labValue.listBySourceDocument(documentId),
      repos.labReport.listBySourceDocument(documentId),
      repos.supplement.listBySourceDocument(documentId),
      repos.openPoint.listBySourceDocument(documentId),
    ]);
    await Promise.all([
      ...obs.map((e) => repos.observation.update(e.id, { sourceDocumentId: undefined })),
      ...vals.map((e) => repos.labValue.update(e.id, { sourceDocumentId: undefined })),
      ...rpts.map((e) => repos.labReport.update(e.id, { sourceDocumentId: undefined })),
      ...supp.map((e) => repos.supplement.update(e.id, { sourceDocumentId: undefined })),
      ...ops.map((e) => repos.openPoint.update(e.id, { sourceDocumentId: undefined })),
    ]);
  } catch (error) {
    return { kind: 'cleanup-failed', error };
  }

  await docRepo.delete(documentId);
  return { kind: 'ok' };
}

function repoDefaults(options: CountOptions) {
  return {
    observation: options.repos?.observation ?? new ObservationRepository(),
    labValue: options.repos?.labValue ?? new LabValueRepository(),
    labReport:
      options.repos?.labReport ??
      new LabReportRepository(options.repos?.labValue ?? new LabValueRepository()),
    supplement: options.repos?.supplement ?? new SupplementRepository(),
    openPoint: options.repos?.openPoint ?? new OpenPointRepository(),
  };
}
