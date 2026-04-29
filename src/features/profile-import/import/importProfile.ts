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
  const replaceExisting = options.replaceExisting ?? false;

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
  if (!replaceExisting && !countsAreEmpty(existingCounts)) {
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
  const allParsedAndSynthesizedVersions = [
    ...parseResult.profileVersions,
    synthesizedImportVersion,
  ];
  const profileVersionRows = await Promise.all(
    allParsedAndSynthesizedVersions.map((parsed) =>
      profileVersionRepo.serialize(wrapEntity<ProfileVersion>(parsed, targetProfileId, now)),
    ),
  );

  const timelineEntryRows = await Promise.all(
    parseResult.timelineEntries.map((parsed) =>
      timelineEntryRepo.serialize(wrapEntity<TimelineEntry>(parsed, targetProfileId, now)),
    ),
  );

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
      // Stryker disable next-line ConditionalExpression: defense-in-depth; only reached when target is empty (no-op) or replaceExisting=true
      if (replaceExisting) {
        await Promise.all([
          deleteByProfileId(db.observations, targetProfileId),
          deleteByProfileId(db.labReports, targetProfileId),
          deleteByProfileId(db.labValues, targetProfileId),
          deleteByProfileId(db.supplements, targetProfileId),
          deleteByProfileId(db.openPoints, targetProfileId),
          deleteByProfileId(db.profileVersions, targetProfileId),
          deleteByProfileId(db.timelineEntries, targetProfileId),
        ]);
      }

      await Promise.all([
        db.profiles.put(profileRow),
        bulkPut(db.observations, observationRows),
        bulkPut(db.labReports, labReportRows),
        bulkPut(db.labValues, labValueRows),
        bulkPut(db.supplements, supplementRows),
        bulkPut(db.openPoints, openPointRows),
        bulkPut(db.profileVersions, profileVersionRows),
        bulkPut(db.timelineEntries, timelineEntryRows),
      ]);
    },
  );

  const created: EntityCounts = {
    ...EMPTY_COUNTS,
    observations: parseResult.observations.length,
    labReports: parseResult.labReports.length,
    labValues: parseResult.labValues.length,
    supplements: parseResult.supplements.length,
    openPoints: parseResult.openPoints.length,
    // IM-04: count includes the synthesized "Profil aus Datei
    // importiert" row alongside any rows lifted from the source
    // markdown's Versionshistorie, so the import-success summary
    // numbers match the actual DB content.
    profileVersions: allParsedAndSynthesizedVersions.length,
    timelineEntries: parseResult.timelineEntries.length,
  };

  return {
    targetProfileId,
    created,
    replaced: replaceExisting && !countsAreEmpty(existingCounts),
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
