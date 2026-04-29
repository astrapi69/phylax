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

/**
 * Per-type replace selection (IM-05).
 *
 * Each flag controls whether existing entities of that type on the
 * target profile are deleted before the imported entities are written.
 * Missing keys default to `false` (preserve existing). Lab data is
 * intentionally a single combined toggle (`labData`) covering both
 * `LabReport` and its child `LabValue` rows: splitting the toggle
 * would let users either orphan child values or insert empty reports
 * (Q6 lock).
 *
 * `Profile` itself (BaseData / warningSigns / etc.) is never wiped —
 * always merged via `mergeProfile()`. Identity-level data should not
 * be silently replaced by per-type toggles.
 */
export interface PerTypeReplace {
  observations?: boolean;
  /** Combined LabReport + LabValue toggle. */
  labData?: boolean;
  supplements?: boolean;
  openPoints?: boolean;
  timelineEntries?: boolean;
  /**
   * Existing ProfileVersion rows lifted from the source markdown's
   * Versionshistorie. The IM-04 auto-synthesized "Profil aus Datei
   * importiert" row writes regardless of this flag (it is the
   * import-gesture marker, not data being imported).
   */
  profileVersions?: boolean;
}

export interface ImportOptions {
  /**
   * Replace policy. Three forms:
   *   - `true`: replace ALL types (legacy boolean form, current
   *     happy-path UX).
   *   - `false` / `undefined`: replace NONE; throws
   *     `ImportTargetNotEmptyError` when the target is non-empty.
   *   - `PerTypeReplace` object: per-type selection. Missing keys
   *     default to `false`. Used by IM-05 selective merge.
   *
   * The discriminated-union shape preserves backwards-compatibility
   * for existing callers that pass `true` and lets the dialog flow
   * pick a per-type subset.
   */
  replaceExisting?: boolean | PerTypeReplace;
}

const ALL_TRUE: Required<PerTypeReplace> = {
  observations: true,
  labData: true,
  supplements: true,
  openPoints: true,
  timelineEntries: true,
  profileVersions: true,
};

/**
 * Resolve `ImportOptions.replaceExisting` to a fully-populated
 * PerTypeReplace map driving the write decisions inside the
 * transaction body.
 *
 *   - `true`: all-true (legacy "replace + write everything").
 *   - object form: per-type; missing keys default to `false`.
 *   - `false` / `undefined`: all-true. Reasoning: the legacy default
 *     contract is "write everything to an empty target; throw on a
 *     non-empty target". The throw guard is enforced separately by
 *     `userAuthorisedAnyReplace()` below, so the write-decision map
 *     can stay all-true safely. On an empty target the per-type
 *     deletes are no-ops; on a non-empty target the throw guard
 *     fires before any writes happen.
 */
export function resolvePerTypeReplace(
  replaceExisting: ImportOptions['replaceExisting'],
): Required<PerTypeReplace> {
  if (typeof replaceExisting === 'object' && replaceExisting !== null) {
    return {
      observations: replaceExisting.observations ?? false,
      labData: replaceExisting.labData ?? false,
      supplements: replaceExisting.supplements ?? false,
      openPoints: replaceExisting.openPoints ?? false,
      timelineEntries: replaceExisting.timelineEntries ?? false,
      profileVersions: replaceExisting.profileVersions ?? false,
    };
  }
  return { ...ALL_TRUE };
}

/**
 * True when the caller has explicitly authorised at least one type
 * replacement against a non-empty target. Drives the
 * `ImportTargetNotEmptyError` throw guard.
 *
 *   - `true`: yes (full replace).
 *   - object form: yes iff at least one flag is true.
 *   - `false` / `undefined`: no (default-deny).
 */
export function userAuthorisedAnyReplace(
  replaceExisting: ImportOptions['replaceExisting'],
): boolean {
  if (replaceExisting === true) return true;
  if (typeof replaceExisting === 'object' && replaceExisting !== null) {
    return (
      replaceExisting.observations === true ||
      replaceExisting.labData === true ||
      replaceExisting.supplements === true ||
      replaceExisting.openPoints === true ||
      replaceExisting.timelineEntries === true ||
      replaceExisting.profileVersions === true
    );
  }
  return false;
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
