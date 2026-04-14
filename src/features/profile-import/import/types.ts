/**
 * Counts of per-profile entities. Used for preview summaries, replace
 * warnings, and import results.
 */
export interface EntityCounts {
  observations: number;
  labReports: number;
  labValues: number;
  supplements: number;
  openPoints: number;
  profileVersions: number;
  timelineEntries: number;
}

export interface ImportOptions {
  /**
   * When true, delete every non-profile entity belonging to the target
   * profile before writing imported data. When false (default) an
   * `ImportTargetNotEmptyError` is thrown if the target already holds data.
   */
  replaceExisting?: boolean;
}

export interface ImportResult {
  targetProfileId: string;
  /** Counts of new entities written in this import. */
  created: EntityCounts;
  /** True when existing data was deleted before writing. */
  replaced: boolean;
}

/**
 * Thrown by `importProfile` when the target profile already has entities
 * and `replaceExisting` is not set. Carries the existing counts so the UI
 * can show what would be overwritten without a second DB round-trip.
 */
export class ImportTargetNotEmptyError extends Error {
  readonly targetProfileId: string;
  readonly existingCounts: EntityCounts;

  constructor(targetProfileId: string, existingCounts: EntityCounts) {
    super(
      `Target profile ${targetProfileId} has existing data; pass replaceExisting=true to overwrite.`,
    );
    this.name = 'ImportTargetNotEmptyError';
    this.targetProfileId = targetProfileId;
    this.existingCounts = existingCounts;
  }
}

export const EMPTY_COUNTS: EntityCounts = {
  observations: 0,
  labReports: 0,
  labValues: 0,
  supplements: 0,
  openPoints: 0,
  profileVersions: 0,
  timelineEntries: 0,
};

export function countsAreEmpty(c: EntityCounts): boolean {
  return (
    c.observations === 0 &&
    c.labReports === 0 &&
    c.labValues === 0 &&
    c.supplements === 0 &&
    c.openPoints === 0 &&
    c.profileVersions === 0 &&
    c.timelineEntries === 0
  );
}
