import type { EncryptedRow } from '../../../db/types';
import { db } from '../../../db/schema';
import {
  ProfileRepository,
  ObservationRepository,
  LabReportRepository,
  LabValueRepository,
  SupplementRepository,
  OpenPointRepository,
  ProfileVersionRepository,
  TimelineEntryRepository,
} from '../../../db/repositories';
import { generateId } from '../../../crypto';
import type {
  Profile,
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  ProfileVersion,
  TimelineEntry,
  BaseData,
} from '../../../domain';
import type { ParseResult, ParsedProfile } from '../parser/types';
import {
  EMPTY_COUNTS,
  ImportTargetNotEmptyError,
  countsAreEmpty,
  resolvePerTypeMode,
  userAuthorisedAnyReplace,
  userAuthorisedAnyWrite,
  type EntityCounts,
  type ImportMode,
  type ImportOptions,
  type ImportResult,
} from './types';
import { countEntities } from './countEntities';
import { bumpVersion } from '../../../domain/profileVersion/bumpVersion';
import {
  matchObservations,
  matchSupplements,
  matchOpenPoints,
  matchProfileVersions,
  matchTimelineEntries,
  resolveMerge,
  type MergeMatch,
  type MergeableEntityKey,
  type MergePlan,
  type MergeResolutions,
} from '../../../domain/import-merge';

/**
 * IM-04: every successful import emits one synthesized ProfileVersion
 * row recording the import gesture itself. Matches the O-16 pattern
 * (manual base-data edit also creates a version row + bumps
 * Profile.version) so the post-import profile carries an unambiguous
 * audit trail regardless of whether the source markdown had its own
 * Versionshistorie.
 */
const IMPORT_CHANGE_DESCRIPTION = 'Profil aus Datei importiert';

/**
 * Import a parsed markdown profile into the Phylax database under a
 * chosen target profile.
 *
 * Transaction strategy (per ADR / IM-03a plan):
 *
 * 1. Read the current target profile outside the transaction.
 * 2. Pre-encrypt every entity into an `EncryptedRow` outside the
 *    transaction. Dexie aborts a transaction as soon as control
 *    yields on a non-Dexie promise, so all `crypto.subtle` work
 *    has to finish before the transaction body starts.
 * 3. Open one read-write transaction over all affected tables.
 *    Inside the body only call Dexie methods. When `replaceExisting`
 *    is true, delete existing rows by `profileId` first, then
 *    `bulkPut` the pre-encrypted rows. On any failure Dexie rolls
 *    back the whole transaction, so the database stays consistent.
 *
 * Fields not covered by the parse result are preserved on the target
 * profile (name, profileType, managedBy). This matters because the
 * parser cannot infer profileType from Markdown alone.
 */
export async function importProfile(
  parseResult: ParseResult,
  targetProfileId: string,
  options: ImportOptions = {},
): Promise<ImportResult> {
  // IM-05 Option B: replaceExisting accepts boolean (legacy) OR
  // PerTypeMode object (selective merge with three modes). Three
  // helpers split the policy:
  //   resolvePerTypeMode(...)         -> per-type 'replace' / 'add' /
  //                                      'skip' decision map
  //   userAuthorisedAnyWrite(...)     -> throw-guard authorisation
  //                                      (any non-skip authorises a
  //                                      write to a non-empty target)
  //   userAuthorisedAnyReplace(...)   -> drives `replaced` field on
  //                                      the ImportResult (only
  //                                      destructive 'replace' counts)
  //
  // The map is ALL_REPLACE for legacy boolean / undefined inputs so
  // the legacy write-everything-on-empty-target contract is preserved.
  // The throw guard is independent: undefined / false default-deny on
  // a non-empty target, true and object-with-any-non-skip authorise.
  const modeMap = resolvePerTypeMode(options.replaceExisting);
  const userAuthorisedWrite = userAuthorisedAnyWrite(options.replaceExisting);
  const userAuthorisedReplace = userAuthorisedAnyReplace(options.replaceExisting);

  const profileRepo = new ProfileRepository();
  const observationRepo = new ObservationRepository();
  const labValueRepo = new LabValueRepository();
  const labReportRepo = new LabReportRepository(labValueRepo);
  const supplementRepo = new SupplementRepository();
  const openPointRepo = new OpenPointRepository();
  const profileVersionRepo = new ProfileVersionRepository();
  const timelineEntryRepo = new TimelineEntryRepository();

  const existingProfile = await profileRepo.getById(targetProfileId);
  if (!existingProfile) {
    throw new Error(`Target profile ${targetProfileId} not found`);
  }

  const existingCounts = await countEntities(targetProfileId);
  if (!userAuthorisedWrite && !countsAreEmpty(existingCounts)) {
    throw new ImportTargetNotEmptyError(targetProfileId, existingCounts);
  }

  const now = Date.now();

  // Merge parsed profile fields into the existing target. Unset fields
  // on the parse result must not wipe existing values.
  const mergedProfileBase: Profile = mergeProfile(existingProfile, parseResult.profile, now);

  // IM-04: bump Profile.version on the imported profile so the
  // synthesized "Profil aus Datei importiert" ProfileVersion row that
  // we add below carries a strictly-increasing version string. Uses
  // the same bumpVersion() shared with the manual-edit path (O-16)
  // and the AI-commit path so all version-creating flows stay in
  // sync. Mirrors the in-memory mergedProfile that goes to the DB
  // and the import return value.
  const importedVersion = bumpVersion(mergedProfileBase.version);
  const mergedProfile: Profile = { ...mergedProfileBase, version: importedVersion };
  const profileRow = await profileRepo.serialize(mergedProfile);

  // Assign ids to lab reports up front so lab values can reference them.
  // Every parsed entity is promoted to a full domain entity with a fresh
  // id, targetProfileId as profileId, and matching timestamps.
  const labReportIds: string[] = parseResult.labReports.map(() => generateId());

  // IM-05 ('replace' / 'add') row arrays: every parsed entity wrapped
  // and serialized up-front. These arrays are the source of truth for
  // the legacy non-merge branches.
  const observationEntities: Observation[] = parseResult.observations.map((parsed) =>
    wrapEntity<Observation>(parsed, targetProfileId, now),
  );
  const observationRows = await Promise.all(
    observationEntities.map((entity) => observationRepo.serialize(entity)),
  );

  // IM-06 'merge' mode: when at least one type is in merge mode, we
  // need the corresponding pre-encrypted MERGED row arrays too. These
  // are built by `prepareMergeRows` which loads existing rows,
  // matches parsed against them, resolves conflicts via
  // ImportOptions.resolutions, and serializes inserts + updates into
  // a single EncryptedRow[] ready for bulkPut. All async work happens
  // OUTSIDE the transaction body (Dexie aborts on non-Dexie awaits).
  // Throws UnresolvedConflictError if any 'conflict' match lacks a
  // resolution entry (Q2 discipline) - the catch is at the route
  // boundary so the transaction never opens on bad input.
  const observationMergeRows =
    modeMap.observations === 'merge'
      ? await prepareMergeRows<Observation, 'observations'>(
          observationRepo,
          matchObservations,
          observationEntities,
          options.resolutions?.observations ?? {},
          targetProfileId,
          now,
        )
      : null;

  const labReportRows = await Promise.all(
    parseResult.labReports.map((parsed, i) =>
      labReportRepo.serialize(wrapEntity<LabReport>(parsed, targetProfileId, now, labReportIds[i])),
    ),
  );

  const labValueRows = await Promise.all(
    parseResult.labValues.map((parsed) => {
      const reportId = labReportIds[parsed.reportIndex];
      if (reportId === undefined) {
        throw new Error(
          `Lab value references unknown reportIndex ${parsed.reportIndex} (only ${labReportIds.length} lab reports in parse result)`,
        );
      }
      const entity = wrapEntity<LabValue>(
        {
          category: parsed.category,
          parameter: parsed.parameter,
          result: parsed.result,
          unit: parsed.unit,
          referenceRange: parsed.referenceRange,
          assessment: parsed.assessment,
          reportId,
        },
        targetProfileId,
        now,
      );
      return labValueRepo.serialize(entity);
    }),
  );

  const supplementEntities: Supplement[] = parseResult.supplements.map((parsed) =>
    wrapEntity<Supplement>(parsed, targetProfileId, now),
  );
  const supplementRows = await Promise.all(
    supplementEntities.map((entity) => supplementRepo.serialize(entity)),
  );
  const supplementMergeRows =
    modeMap.supplements === 'merge'
      ? await prepareMergeRows<Supplement, 'supplements'>(
          supplementRepo,
          matchSupplements,
          supplementEntities,
          options.resolutions?.supplements ?? {},
          targetProfileId,
          now,
        )
      : null;

  const openPointEntities: OpenPoint[] = parseResult.openPoints.map((parsed) =>
    wrapEntity<OpenPoint>(parsed, targetProfileId, now),
  );
  const openPointRows = await Promise.all(
    openPointEntities.map((entity) => openPointRepo.serialize(entity)),
  );
  const openPointMergeRows =
    modeMap.openPoints === 'merge'
      ? await prepareMergeRows<OpenPoint, 'openPoints'>(
          openPointRepo,
          matchOpenPoints,
          openPointEntities,
          options.resolutions?.openPoints ?? {},
          targetProfileId,
          now,
        )
      : null;

  // IM-04: append one synthesized ProfileVersion row recording the
  // import gesture itself. Carries the bumped Profile.version (set
  // above) and the German-constant changeDescription, matching the
  // shape used by the parser when it lifts rows out of the source
  // markdown's Versionshistorie. `now` ISO-formatted to YYYY-MM-DD
  // so changeDate matches the existing display format.
  const importedChangeDate = new Date(now).toISOString().slice(0, 10);
  const synthesizedImportVersion: Omit<
    ProfileVersion,
    'id' | 'profileId' | 'createdAt' | 'updatedAt'
  > = {
    version: importedVersion,
    changeDescription: IMPORT_CHANGE_DESCRIPTION,
    changeDate: importedChangeDate,
  };
  // IM-05 Option B: profileVersions has three write modes.
  //   modeMap.profileVersions='replace' -> wipe existing + write
  //                                         [parsed source rows
  //                                          + synthesized marker]
  //   modeMap.profileVersions='add'     -> keep existing + write
  //                                         [parsed source rows
  //                                          + synthesized marker]
  //   modeMap.profileVersions='skip'    -> keep existing + write
  //                                         [synthesized marker only]
  // The synthesized "Profil aus Datei importiert" row writes
  // unconditionally because it records the import-gesture itself,
  // not data being imported (Q5 lock from original IM-05). The pre-
  // encrypted row arrays for both modes are prepared up-front so
  // the transaction body only does Dexie I/O.
  const synthesizedImportVersionRow = await profileVersionRepo.serialize(
    wrapEntity<ProfileVersion>(synthesizedImportVersion, targetProfileId, now),
  );
  const parsedProfileVersionRows = await Promise.all(
    parseResult.profileVersions.map((parsed) =>
      profileVersionRepo.serialize(wrapEntity<ProfileVersion>(parsed, targetProfileId, now)),
    ),
  );
  const profileVersionRowsForReplaceMode = [
    ...parsedProfileVersionRows,
    synthesizedImportVersionRow,
  ];
  const profileVersionRowsForKeepMode = [synthesizedImportVersionRow];

  const timelineEntryEntities: TimelineEntry[] = parseResult.timelineEntries.map((parsed) =>
    wrapEntity<TimelineEntry>(parsed, targetProfileId, now),
  );
  const timelineEntryRows = await Promise.all(
    timelineEntryEntities.map((entity) => timelineEntryRepo.serialize(entity)),
  );
  const timelineEntryMergeRows =
    modeMap.timelineEntries === 'merge'
      ? await prepareMergeRows<TimelineEntry, 'timelineEntries'>(
          timelineEntryRepo,
          matchTimelineEntries,
          timelineEntryEntities,
          options.resolutions?.timelineEntries ?? {},
          targetProfileId,
          now,
        )
      : null;

  // IM-06 profile-versions merge: like the other types but with the
  // synthesized "Profil aus Datei importiert" marker still appended
  // unconditionally per Q5 (the marker is the import gesture, not
  // data). The marker is added AFTER the merge plan resolves so it
  // never participates in the natural-key matcher.
  const parsedProfileVersionEntities: ProfileVersion[] = parseResult.profileVersions.map((parsed) =>
    wrapEntity<ProfileVersion>(parsed, targetProfileId, now),
  );
  const profileVersionMergeRowsBase =
    modeMap.profileVersions === 'merge'
      ? await prepareMergeRows<ProfileVersion, 'profileVersions'>(
          profileVersionRepo,
          matchProfileVersions,
          parsedProfileVersionEntities,
          options.resolutions?.profileVersions ?? {},
          targetProfileId,
          now,
        )
      : null;
  const profileVersionMergeRows = profileVersionMergeRowsBase
    ? [...profileVersionMergeRowsBase, synthesizedImportVersionRow]
    : null;

  // IM-05 Option B per-type branching. For each type:
  //   modeMap.X = 'replace' -> deleteByProfileId + bulkPut(imported)
  //   modeMap.X = 'add'     -> no delete; bulkPut(imported) only
  //                            (existing rows untouched; imported
  //                            entities have fresh IDs from
  //                            generateId() in wrapEntity, so PK
  //                            collisions are impossible by
  //                            construction)
  //   modeMap.X = 'skip'    -> no delete + no bulkPut (existing
  //                            kept, imported dropped)
  //
  // Lab data (LabReport + LabValue) stays a single combined toggle
  // (Q6 lock from original IM-05): the LabValue.reportId FK is
  // assigned up-front from `labReportIds[]`, so 'add' mode preserves
  // FK consistency for the new reports while the old reports + their
  // values stay intact under their existing IDs.
  // ProfileVersions has its own three-mode handler below
  // (synthesized marker writes unconditionally per Q5).
  // Profile.profiles is always written via mergeProfile() (Q4 lock --
  // identity-level data is never wiped by per-type toggles).
  await db.transaction(
    'rw',
    [
      db.profiles,
      db.observations,
      db.labReports,
      db.labValues,
      db.supplements,
      db.openPoints,
      db.profileVersions,
      db.timelineEntries,
    ],
    async () => {
      const ops: Promise<unknown>[] = [db.profiles.put(profileRow)];

      applyMode(
        ops,
        modeMap.observations,
        db.observations,
        observationRows,
        targetProfileId,
        observationMergeRows,
      );

      if (modeMap.labData === 'replace') {
        ops.push(deleteByProfileId(db.labReports, targetProfileId));
        ops.push(deleteByProfileId(db.labValues, targetProfileId));
        ops.push(bulkPut(db.labReports, labReportRows));
        ops.push(bulkPut(db.labValues, labValueRows));
      } else if (modeMap.labData === 'add') {
        ops.push(bulkPut(db.labReports, labReportRows));
        ops.push(bulkPut(db.labValues, labValueRows));
      }
      // labData 'merge' deferred to Step 3b (FK rewiring across
      // matched parent reports). Until then, callers must use
      // 'replace', 'add', or 'skip' for labData; passing 'merge'
      // here is a no-op (transaction body skips, no error thrown
      // so type-system gates remain a UI concern).

      applyMode(
        ops,
        modeMap.supplements,
        db.supplements,
        supplementRows,
        targetProfileId,
        supplementMergeRows,
      );
      applyMode(
        ops,
        modeMap.openPoints,
        db.openPoints,
        openPointRows,
        targetProfileId,
        openPointMergeRows,
      );
      applyMode(
        ops,
        modeMap.timelineEntries,
        db.timelineEntries,
        timelineEntryRows,
        targetProfileId,
        timelineEntryMergeRows,
      );

      if (modeMap.profileVersions === 'replace') {
        ops.push(deleteByProfileId(db.profileVersions, targetProfileId));
        ops.push(bulkPut(db.profileVersions, profileVersionRowsForReplaceMode));
      } else if (modeMap.profileVersions === 'add') {
        // Add: keep existing + write parsed source rows + synthesized marker.
        ops.push(bulkPut(db.profileVersions, profileVersionRowsForReplaceMode));
      } else if (modeMap.profileVersions === 'merge') {
        // Merge: bulkPut the merge plan's row slice (inserts +
        // updates) plus the synthesized marker. Existing rows not
        // in the plan are preserved (no delete).
        if (!profileVersionMergeRows) {
          throw new Error('profileVersionMergeRows missing in merge mode');
        }
        ops.push(bulkPut(db.profileVersions, profileVersionMergeRows));
      } else {
        // Skip: synthesized marker still writes (Q5).
        ops.push(bulkPut(db.profileVersions, profileVersionRowsForKeepMode));
      }

      await Promise.all(ops);
    },
  );

  // IM-05 Option B: counts reflect what was actually written. Skipped
  // types contribute zero to `created` (their parsed rows were
  // dropped). 'replace' and 'add' both write the full parsed batch so
  // they count the same. ProfileVersions count: parsed + synthesized
  // in 'replace' / 'add', synthesized only in 'skip' (mirrors the
  // transaction body above).
  const wrote = (m: typeof modeMap.observations): boolean => m !== 'skip';
  const created: EntityCounts = {
    ...EMPTY_COUNTS,
    observations: wrote(modeMap.observations) ? parseResult.observations.length : 0,
    labReports: wrote(modeMap.labData) ? parseResult.labReports.length : 0,
    labValues: wrote(modeMap.labData) ? parseResult.labValues.length : 0,
    supplements: wrote(modeMap.supplements) ? parseResult.supplements.length : 0,
    openPoints: wrote(modeMap.openPoints) ? parseResult.openPoints.length : 0,
    profileVersions: wrote(modeMap.profileVersions)
      ? profileVersionRowsForReplaceMode.length
      : profileVersionRowsForKeepMode.length,
    timelineEntries: wrote(modeMap.timelineEntries) ? parseResult.timelineEntries.length : 0,
  };

  return {
    targetProfileId,
    created,
    // `replaced` is true iff the user authorised at least one type
    // replacement AND the target had pre-existing data to delete.
    // Preserves the legacy contract used by the success-screen UI.
    replaced: userAuthorisedReplace && !countsAreEmpty(existingCounts),
  };
}

function wrapEntity<
  T extends { id: string; profileId: string; createdAt: number; updatedAt: number },
>(
  parsed: Omit<T, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>,
  profileId: string,
  now: number,
  id: string = generateId(),
): T {
  return {
    ...parsed,
    id,
    profileId,
    createdAt: now,
    updatedAt: now,
  } as T;
}

function mergeProfile(existing: Profile, parsed: ParsedProfile | null, now: number): Profile {
  if (!parsed) {
    // Still bump updatedAt so the import moment is traceable via the row timestamp.
    return { ...existing, updatedAt: now };
  }

  const mergedBaseData: BaseData = {
    ...existing.baseData,
    ...stripUndefined(parsed.baseData),
    // Preserve profileType and managedBy from the existing profile unless
    // the parser explicitly set them (parser cannot infer profileType so
    // these usually come from the profile creation form).
    profileType: parsed.baseData.profileType ?? existing.baseData.profileType,
    managedBy: parsed.baseData.managedBy ?? existing.baseData.managedBy,
    // Arrays on BaseData replace rather than merge because the parsed
    // view is the authoritative snapshot from the source Markdown.
    weightHistory: parsed.baseData.weightHistory ?? existing.baseData.weightHistory,
    knownDiagnoses: parsed.baseData.knownDiagnoses ?? existing.baseData.knownDiagnoses,
    currentMedications: parsed.baseData.currentMedications ?? existing.baseData.currentMedications,
    relevantLimitations:
      parsed.baseData.relevantLimitations ?? existing.baseData.relevantLimitations,
  };

  return {
    ...existing,
    baseData: mergedBaseData,
    warningSigns: parsed.warningSigns.length > 0 ? parsed.warningSigns : existing.warningSigns,
    externalReferences:
      parsed.externalReferences.length > 0
        ? parsed.externalReferences
        : existing.externalReferences,
    version: parsed.version || existing.version,
    lastUpdateReason: parsed.lastUpdateReason ?? existing.lastUpdateReason,
    updatedAt: now,
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

async function bulkPut(
  table: { bulkPut(rows: EncryptedRow[]): Promise<unknown> },
  rows: EncryptedRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await table.bulkPut(rows);
}

/**
 * Per-type four-mode dispatcher for the simple single-table cases
 * (observations, supplements, openPoints, timelineEntries). Lab data
 * has its own custom branch above because the LabReport+LabValue FK
 * grouping prevents reuse of this helper.
 *
 * `'merge'` mode (IM-06) requires `mergeRows` precomputed by
 * `prepareMergeRows` outside the transaction. Inserts + updates flow
 * through a single bulkPut; existing rows whose ids do not appear in
 * the slice stay untouched (Dexie keeps them, watchpoint W1 absent-
 * entity preservation). Throws if mergeRows is null when mode is
 * 'merge' - caller bug (the merge slice should have been computed
 * up-front).
 */
function applyMode(
  ops: Promise<unknown>[],
  mode: ImportMode,
  table: {
    bulkPut(rows: EncryptedRow[]): Promise<unknown>;
    where(index: string): { equals(value: string): { delete(): Promise<number> } };
  },
  rows: EncryptedRow[],
  profileId: string,
  mergeRows: EncryptedRow[] | null,
): void {
  if (mode === 'replace') {
    ops.push(deleteByProfileId(table, profileId));
    ops.push(bulkPut(table, rows));
  } else if (mode === 'add') {
    ops.push(bulkPut(table, rows));
  } else if (mode === 'merge') {
    if (!mergeRows) {
      throw new Error('applyMode: merge mode requires precomputed mergeRows');
    }
    ops.push(bulkPut(table, mergeRows));
  }
  // 'skip' = no-op
}

/**
 * IM-06 helper. Loads existing rows for a profile, runs the
 * type-specific matcher against the parsed entities, resolves
 * conflicts via the user-supplied resolutions map, and serializes
 * the resulting plan (inserts + updates) into a single
 * `EncryptedRow[]` ready for bulkPut.
 *
 * All async work happens OUTSIDE the import transaction so Dexie's
 * `aborts-on-non-Dexie-await` rule is respected. Existing rows
 * with no parsed counterpart are absent from both `inserts` and
 * `updates`, which means they stay untouched at write time
 * (watchpoint W1 absent-entity preservation).
 *
 * Throws `UnresolvedConflictError` when any 'conflict' match lacks
 * an entry in `resolutions` (Q2 discipline) or when
 * 'field-by-field' resolution leaves a conflicting field without
 * an explicit pick. The throw happens BEFORE the transaction
 * opens, so on bad input the vault stays untouched (W1 atomicity).
 */
async function prepareMergeRows<
  T extends { id: string; profileId: string; createdAt: number; updatedAt: number },
  K extends MergeableEntityKey,
>(
  repo: {
    listByProfile(profileId: string): Promise<T[]>;
    serialize(entity: T): Promise<EncryptedRow>;
  },
  matcher: (existing: T[], parsed: T[]) => MergeMatch<K>[],
  parsedAsEntities: T[],
  resolutionsForType: NonNullable<MergeResolutions[K]>,
  targetProfileId: string,
  now: number,
): Promise<EncryptedRow[]> {
  const existing = await repo.listByProfile(targetProfileId);
  const matches = matcher(existing, parsedAsEntities);
  // Cast through unknown: at the generic level TypeScript cannot
  // prove that `MergeResolutions[K]` and `ResolutionMap<K>` share
  // the same shape (they do; both are `Record<string,
  // ConflictResolution<K>>`). Each call site supplies the correctly
  // narrowed K so the cast is sound at every invocation.
  const plan: MergePlan<K> = resolveMerge<K>(
    matches,
    resolutionsForType as unknown as Parameters<typeof resolveMerge<K>>[1],
  );

  const rows: EncryptedRow[] = [];
  for (const insertEntity of plan.inserts) {
    rows.push(await repo.serialize(insertEntity as unknown as T));
  }
  for (const update of plan.updates) {
    const existingEntity = existing.find((e) => e.id === update.existingId);
    if (!existingEntity) {
      throw new Error(`prepareMergeRows: update target ${update.existingId} not in existing slice`);
    }
    const merged = { ...existingEntity, ...(update.patch as Partial<T>), updatedAt: now } as T;
    rows.push(await repo.serialize(merged));
  }
  return rows;
}

async function deleteByProfileId(
  table: {
    where(index: string): { equals(value: string): { delete(): Promise<number> } };
  },
  profileId: string,
): Promise<void> {
  await table.where('profileId').equals(profileId).delete();
}
