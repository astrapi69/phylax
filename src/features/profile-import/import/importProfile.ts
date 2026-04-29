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
  resolvePerTypeReplace,
  userAuthorisedAnyReplace,
  type EntityCounts,
  type ImportOptions,
  type ImportResult,
} from './types';
import { countEntities } from './countEntities';
import { bumpVersion } from '../../../domain/profileVersion/bumpVersion';

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
  // IM-05: replaceExisting accepts boolean (legacy) OR PerTypeReplace
  // object (selective merge). Two helpers split the policy:
  //   resolvePerTypeReplace(...) -> per-type write-decision map
  //   userAuthorisedAnyReplace(...) -> throw-guard authorisation
  //
  // The map is all-true for legacy boolean / undefined inputs so the
  // legacy write-everything-on-empty-target contract is preserved.
  // The throw guard is independent: undefined / false default-deny
  // on a non-empty target, true and object-with-any-true authorise.
  const replaceMap = resolvePerTypeReplace(options.replaceExisting);
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
  if (!userAuthorisedReplace && !countsAreEmpty(existingCounts)) {
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

  const observationRows = await Promise.all(
    parseResult.observations.map((parsed) =>
      observationRepo.serialize(wrapEntity<Observation>(parsed, targetProfileId, now)),
    ),
  );

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

  const supplementRows = await Promise.all(
    parseResult.supplements.map((parsed) =>
      supplementRepo.serialize(wrapEntity<Supplement>(parsed, targetProfileId, now)),
    ),
  );

  const openPointRows = await Promise.all(
    parseResult.openPoints.map((parsed) =>
      openPointRepo.serialize(wrapEntity<OpenPoint>(parsed, targetProfileId, now)),
    ),
  );

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
  // IM-05: profileVersions has two write modes depending on the
  // per-type replace flag.
  //   replaceMap.profileVersions=true   -> wipe existing + write
  //                                         [parsed source rows
  //                                          + synthesized marker]
  //   replaceMap.profileVersions=false  -> keep existing + write
  //                                         [synthesized marker
  //                                          only]
  // The synthesized "Profil aus Datei importiert" row writes
  // unconditionally because it records the import-gesture itself,
  // not data being imported (Q5 lock). The pre-encrypted row arrays
  // for both modes are prepared up-front so the transaction body
  // only does Dexie I/O.
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

  const timelineEntryRows = await Promise.all(
    parseResult.timelineEntries.map((parsed) =>
      timelineEntryRepo.serialize(wrapEntity<TimelineEntry>(parsed, targetProfileId, now)),
    ),
  );

  // IM-05 per-type branching. For each type:
  //   replaceMap.X = true  -> deleteByProfileId + bulkPut(imported)
  //   replaceMap.X = false -> no delete + no bulkPut (existing kept,
  //                            imported dropped)
  // Lab data (LabReport + LabValue) is a single combined toggle (Q6
  // lock) because the FK from LabValue to LabReport means split
  // toggles would either orphan child rows or insert empty reports.
  // ProfileVersions has its own special mode handled above.
  // Profile.profiles is always written via mergeProfile() (Q4 lock —
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

      if (replaceMap.observations) {
        ops.push(deleteByProfileId(db.observations, targetProfileId));
        ops.push(bulkPut(db.observations, observationRows));
      }

      if (replaceMap.labData) {
        ops.push(deleteByProfileId(db.labReports, targetProfileId));
        ops.push(deleteByProfileId(db.labValues, targetProfileId));
        ops.push(bulkPut(db.labReports, labReportRows));
        ops.push(bulkPut(db.labValues, labValueRows));
      }

      if (replaceMap.supplements) {
        ops.push(deleteByProfileId(db.supplements, targetProfileId));
        ops.push(bulkPut(db.supplements, supplementRows));
      }

      if (replaceMap.openPoints) {
        ops.push(deleteByProfileId(db.openPoints, targetProfileId));
        ops.push(bulkPut(db.openPoints, openPointRows));
      }

      if (replaceMap.timelineEntries) {
        ops.push(deleteByProfileId(db.timelineEntries, targetProfileId));
        ops.push(bulkPut(db.timelineEntries, timelineEntryRows));
      }

      if (replaceMap.profileVersions) {
        ops.push(deleteByProfileId(db.profileVersions, targetProfileId));
        ops.push(bulkPut(db.profileVersions, profileVersionRowsForReplaceMode));
      } else {
        // Q5: synthesized marker still writes even when existing
        // ProfileVersion rows are preserved.
        ops.push(bulkPut(db.profileVersions, profileVersionRowsForKeepMode));
      }

      await Promise.all(ops);
    },
  );

  // IM-05: counts reflect what was actually written. Skipped types
  // contribute zero to `created` (their parsed rows were dropped).
  // ProfileVersions count: parsed rows + synthesized in replace mode,
  // synthesized only in keep mode (mirrors the transaction body
  // above).
  const created: EntityCounts = {
    ...EMPTY_COUNTS,
    observations: replaceMap.observations ? parseResult.observations.length : 0,
    labReports: replaceMap.labData ? parseResult.labReports.length : 0,
    labValues: replaceMap.labData ? parseResult.labValues.length : 0,
    supplements: replaceMap.supplements ? parseResult.supplements.length : 0,
    openPoints: replaceMap.openPoints ? parseResult.openPoints.length : 0,
    profileVersions: replaceMap.profileVersions
      ? profileVersionRowsForReplaceMode.length
      : profileVersionRowsForKeepMode.length,
    timelineEntries: replaceMap.timelineEntries ? parseResult.timelineEntries.length : 0,
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

async function deleteByProfileId(
  table: {
    where(index: string): { equals(value: string): { delete(): Promise<number> } };
  },
  profileId: string,
): Promise<void> {
  await table.where('profileId').equals(profileId).delete();
}
