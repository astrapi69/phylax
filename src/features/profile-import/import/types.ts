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
 * Per-type import mode (IM-05 Option B).
 *
 *   - `'replace'`: delete existing entities of this type, then write
 *     the imported entities. Wipes existing.
 *   - `'add'`: keep existing entities AND write the imported entities.
 *     Both coexist after the import. New entities get fresh IDs via
 *     `generateId()` so PK collisions are impossible by construction.
 *     User is responsible for duplicate avoidance; ConfirmDialog
 *     surfaces a warning when this mode is chosen.
 *   - `'skip'`: keep existing entities, drop imported ones.
 *
 * Lab data (LabReport + LabValue) is intentionally a single combined
 * `labData` toggle covering both tables: splitting the toggle would
 * either orphan child values or insert empty reports (Q6 lock from
 * the original IM-05). FK consistency is preserved across all three
 * modes because `labReportIds[i]` is generated up-front and threaded
 * through both report and value rows.
 *
 * `Profile` itself (BaseData / warningSigns / etc.) is never replaced
 * via per-type modes. It is always merged through `mergeProfile()`
 * so identity-level data is never silently wiped.
 */
export type ImportMode = 'replace' | 'add' | 'skip';

/**
 * Per-type mode map (IM-05 Option B). Each key accepts an
 * `ImportMode` string OR a legacy boolean (`true` -> `'replace'`,
 * `false` -> `'skip'`) so existing callers from the original IM-05
 * `PerTypeReplace` shape continue to typecheck and behave the same.
 *
 *   - missing keys default to `'skip'`
 *   - `boolean` values translate per the table above
 *
 * Existing ProfileVersion rows lifted from the source markdown's
 * Versionshistorie respect this flag in `'replace'` and `'add'`
 * modes; the IM-04 auto-synthesized "Profil aus Datei importiert"
 * row writes regardless of the flag (it represents the import
 * gesture itself, not data being imported).
 */
export interface PerTypeMode {
  observations?: ImportMode | boolean;
  labData?: ImportMode | boolean;
  supplements?: ImportMode | boolean;
  openPoints?: ImportMode | boolean;
  timelineEntries?: ImportMode | boolean;
  profileVersions?: ImportMode | boolean;
}

/**
 * Backwards-compatibility alias for the original IM-05 type. Same
 * shape; new callers should prefer `PerTypeMode` (the canonical
 * name) but no migration is required.
 */
export type PerTypeReplace = PerTypeMode;

export interface ImportOptions {
  /**
   * Replace policy. Three forms:
   *   - `true`: replace ALL types (legacy boolean form).
   *   - `false` / `undefined`: replace NONE; throws
   *     `ImportTargetNotEmptyError` when the target is non-empty.
   *   - `PerTypeMode` object: per-type three-mode selection
   *     (replace / add / skip). Used by IM-05 Option B selective
   *     merge dialog.
   */
  replaceExisting?: boolean | PerTypeMode;
}

export type ResolvedModeMap = Required<{ [K in keyof PerTypeMode]: ImportMode }>;

const ALL_REPLACE: ResolvedModeMap = {
  observations: 'replace',
  labData: 'replace',
  supplements: 'replace',
  openPoints: 'replace',
  timelineEntries: 'replace',
  profileVersions: 'replace',
};

function normalizeMode(v: ImportMode | boolean | undefined): ImportMode {
  if (v === true) return 'replace';
  if (v === false || v === undefined) return 'skip';
  return v;
}

/**
 * Resolve `ImportOptions.replaceExisting` to a fully-populated
 * mode map driving the per-table write decisions inside the
 * transaction body.
 *
 *   - `true`: all-replace (legacy "replace + write everything").
 *   - object form: per-type; missing keys default to `'skip'`.
 *     Boolean values translate per `normalizeMode`.
 *   - `false` / `undefined`: all-replace. Reasoning unchanged from
 *     the original IM-05 contract: the legacy default is "write
 *     everything to an empty target; throw on a non-empty target".
 *     The throw guard is enforced separately by
 *     `userAuthorisedAnyWrite()` below; on an empty target the
 *     per-type 'replace' deletes are no-ops.
 */
export function resolvePerTypeMode(
  replaceExisting: ImportOptions['replaceExisting'],
): ResolvedModeMap {
  if (typeof replaceExisting === 'object' && replaceExisting !== null) {
    return {
      observations: normalizeMode(replaceExisting.observations),
      labData: normalizeMode(replaceExisting.labData),
      supplements: normalizeMode(replaceExisting.supplements),
      openPoints: normalizeMode(replaceExisting.openPoints),
      timelineEntries: normalizeMode(replaceExisting.timelineEntries),
      profileVersions: normalizeMode(replaceExisting.profileVersions),
    };
  }
  return { ...ALL_REPLACE };
}

/**
 * Backwards-compat alias returning a boolean shape for callers that
 * only care whether each type writes-or-not. Maps:
 *   - 'replace' / 'add' -> true
 *   - 'skip'            -> false
 *
 * Kept so external callers / tests reading the resolver output by
 * the old name still typecheck. New code should consume
 * `resolvePerTypeMode` directly for the three-mode distinction.
 */
export function resolvePerTypeReplace(
  replaceExisting: ImportOptions['replaceExisting'],
): Required<{ [K in keyof PerTypeMode]: boolean }> {
  const map = resolvePerTypeMode(replaceExisting);
  return {
    observations: map.observations !== 'skip',
    labData: map.labData !== 'skip',
    supplements: map.supplements !== 'skip',
    openPoints: map.openPoints !== 'skip',
    timelineEntries: map.timelineEntries !== 'skip',
    profileVersions: map.profileVersions !== 'skip',
  };
}

function anyMode(
  replaceExisting: ImportOptions['replaceExisting'],
  predicate: (m: ImportMode) => boolean,
): boolean {
  if (replaceExisting === true) return predicate('replace');
  if (replaceExisting === false || replaceExisting === undefined) return false;
  return (
    predicate(normalizeMode(replaceExisting.observations)) ||
    predicate(normalizeMode(replaceExisting.labData)) ||
    predicate(normalizeMode(replaceExisting.supplements)) ||
    predicate(normalizeMode(replaceExisting.openPoints)) ||
    predicate(normalizeMode(replaceExisting.timelineEntries)) ||
    predicate(normalizeMode(replaceExisting.profileVersions))
  );
}

/**
 * True when the caller has explicitly authorised at least one
 * write (replace OR add) against a non-empty target. Drives the
 * `ImportTargetNotEmptyError` throw guard in `importProfile`.
 *
 *   - `true`: yes (full replace).
 *   - object form: yes iff at least one key is `'replace'`, `'add'`,
 *     or boolean `true`.
 *   - `false` / `undefined`: no (default-deny).
 */
export function userAuthorisedAnyWrite(replaceExisting: ImportOptions['replaceExisting']): boolean {
  return anyMode(replaceExisting, (m) => m !== 'skip');
}

/**
 * True when the caller has explicitly authorised at least one
 * destructive replace (existing rows get deleted). Drives the
 * `ImportResult.replaced` field consumed by the success-screen UI.
 *
 *   - `true`: yes (full replace).
 *   - object form: yes iff at least one key is `'replace'` or
 *     boolean `true`. `'add'` does NOT delete and does NOT count.
 *   - `false` / `undefined`: no.
 */
export function userAuthorisedAnyReplace(
  replaceExisting: ImportOptions['replaceExisting'],
): boolean {
  return anyMode(replaceExisting, (m) => m === 'replace');
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
