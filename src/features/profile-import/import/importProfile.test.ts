import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
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
import { db } from '../../../db/schema';
import { importProfile } from './importProfile';
import { ImportTargetNotEmptyError } from './types';
import type { ParseResult } from '../parser/types';

const TEST_PASSWORD = 'test-password-12';
let profileId: string;

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  const profileRepo = new ProfileRepository();
  const profile = await profileRepo.create({
    baseData: {
      name: 'Mein Profil',
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  });
  profileId = profile.id;
});

function emptyParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    profile: null,
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    report: { recognized: [], warnings: [], unrecognized: [], metadata: {} },
    originalMarkdown: '',
    ...overrides,
  };
}

function obs(theme: string): ParseResult['observations'][number] {
  return {
    theme,
    fact: `${theme} fact`,
    pattern: `${theme} pattern`,
    selfRegulation: `${theme} self-reg`,
    status: 'Stabil',
    source: 'user',
    extraSections: {},
  };
}

describe('importProfile', () => {
  it('imports a full parse result into an empty target profile', async () => {
    const parseResult = emptyParseResult({
      observations: [obs('Knie'), obs('Schulter'), obs('Rücken')],
      labReports: [{ reportDate: '2026-01-15', labName: 'Labor X', categoryAssessments: {} }],
      labValues: [
        {
          reportIndex: 0,
          reportId: '',
          category: 'Blutbild',
          parameter: 'Hb',
          result: '14.2',
        },
        {
          reportIndex: 0,
          reportId: '',
          category: 'Blutbild',
          parameter: 'Leuko',
          result: '6.0',
        },
      ],
      supplements: [{ name: 'Vitamin D3', category: 'daily' }],
      openPoints: [{ text: 'Bluttest', context: 'Arzt', resolved: false }],
      profileVersions: [{ version: '1.0', changeDescription: 'Initial', changeDate: '2026-01-01' }],
      timelineEntries: [
        {
          period: 'Januar 2026',
          title: 'Start',
          content: 'content',
          source: 'user',
        },
      ],
    });

    const result = await importProfile(parseResult, profileId);

    expect(result.targetProfileId).toBe(profileId);
    expect(result.replaced).toBe(false);
    expect(result.created).toEqual({
      observations: 3,
      labReports: 1,
      labValues: 2,
      supplements: 1,
      openPoints: 1,
      // IM-04: 1 row from the source markdown + 1 synthesized
      // "Profil aus Datei importiert" row.
      profileVersions: 2,
      timelineEntries: 1,
    });

    const obsRepo = new ObservationRepository();
    const persisted = await obsRepo.listByProfile(profileId);
    expect(persisted).toHaveLength(3);
    expect(persisted.map((o) => o.theme).sort()).toEqual(['Knie', 'Rücken', 'Schulter']);
  });

  it('refuses to overwrite a non-empty target without replaceExisting', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Existing',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const parseResult = emptyParseResult({ observations: [obs('New')] });

    await expect(importProfile(parseResult, profileId)).rejects.toBeInstanceOf(
      ImportTargetNotEmptyError,
    );
  });

  it('ImportTargetNotEmptyError carries existing counts', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Existing',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const parseResult = emptyParseResult({ observations: [obs('New')] });
    let thrown: unknown;
    try {
      await importProfile(parseResult, profileId);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ImportTargetNotEmptyError);
    const err = thrown as ImportTargetNotEmptyError;
    expect(err.name).toBe('ImportTargetNotEmptyError');
    expect(err.message).toContain('existing data');
    expect(err.targetProfileId).toBe(profileId);
    expect(err.existingCounts.observations).toBe(1);
  });

  it('replaces existing data when replaceExisting=true', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Old',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const parseResult = emptyParseResult({
      observations: [obs('New1'), obs('New2')],
    });

    const result = await importProfile(parseResult, profileId, { replaceExisting: true });
    expect(result.replaced).toBe(true);

    const persisted = await obsRepo.listByProfile(profileId);
    expect(persisted.map((o) => o.theme).sort()).toEqual(['New1', 'New2']);
  });

  it('reports replaced=false when replaceExisting=true but target was empty', async () => {
    const parseResult = emptyParseResult({ observations: [obs('A')] });
    const result = await importProfile(parseResult, profileId, { replaceExisting: true });
    expect(result.replaced).toBe(false);
  });

  it('maps reportIndex to the correct reportId across two reports', async () => {
    const parseResult = emptyParseResult({
      labReports: [
        { reportDate: '2026-01-01', labName: 'A', categoryAssessments: {} },
        { reportDate: '2026-06-01', labName: 'B', categoryAssessments: {} },
      ],
      labValues: [
        { reportIndex: 0, reportId: '', category: 'c', parameter: 'p0', result: '1' },
        { reportIndex: 1, reportId: '', category: 'c', parameter: 'p1', result: '2' },
        { reportIndex: 0, reportId: '', category: 'c', parameter: 'p0b', result: '3' },
      ],
    });

    await importProfile(parseResult, profileId);

    const labValueRepo = new LabValueRepository();
    const labReportRepo = new LabReportRepository(labValueRepo);
    const reports = await labReportRepo.listByProfile(profileId);
    const values = await labValueRepo.listByProfile(profileId);

    const reportA = reports.find((r) => r.labName === 'A');
    const reportB = reports.find((r) => r.labName === 'B');
    expect(reportA).toBeDefined();
    expect(reportB).toBeDefined();

    const valuesForA = values.filter((v) => v.reportId === reportA?.id).map((v) => v.parameter);
    const valuesForB = values.filter((v) => v.reportId === reportB?.id).map((v) => v.parameter);
    expect(valuesForA.sort()).toEqual(['p0', 'p0b']);
    expect(valuesForB).toEqual(['p1']);
  });

  it('assigns targetProfileId to every imported entity', async () => {
    const parseResult = emptyParseResult({
      observations: [obs('x')],
      supplements: [{ name: 'S', category: 'daily' }],
      openPoints: [{ text: 't', context: 'c', resolved: false }],
      timelineEntries: [{ period: 'p', title: 't', content: 'c', source: 'user' }],
      profileVersions: [{ version: '1', changeDescription: 'x', changeDate: '2026-01-01' }],
    });
    await importProfile(parseResult, profileId);

    const obsRepo = new ObservationRepository();
    const suppRepo = new SupplementRepository();
    const opRepo = new OpenPointRepository();
    const teRepo = new TimelineEntryRepository();
    const pvRepo = new ProfileVersionRepository();

    for (const repo of [obsRepo, suppRepo, opRepo, teRepo, pvRepo]) {
      const items = await repo.listByProfile(profileId);
      for (const item of items) {
        expect(item.profileId).toBe(profileId);
      }
    }
  });

  it('merges parsed profile fields without clobbering profileType/name', async () => {
    const parseResult = emptyParseResult({
      profile: {
        baseData: {
          weightHistory: [],
          knownDiagnoses: ['Asthma'],
          currentMedications: [],
          relevantLimitations: [],
          heightCm: 183,
          weightKg: 92,
        },
        warningSigns: ['Schwindel'],
        externalReferences: ['Doc'],
        version: '1.3.1',
        lastUpdateReason: 'Update',
      },
    });

    await importProfile(parseResult, profileId);

    const profileRepo = new ProfileRepository();
    const loaded = await profileRepo.getById(profileId);
    expect(loaded?.baseData.name).toBe('Mein Profil'); // preserved
    expect(loaded?.baseData.profileType).toBe('self'); // preserved
    expect(loaded?.baseData.heightCm).toBe(183); // merged in
    expect(loaded?.baseData.weightKg).toBe(92);
    expect(loaded?.baseData.knownDiagnoses).toEqual(['Asthma']);
    expect(loaded?.warningSigns).toEqual(['Schwindel']);
    // IM-04: import bumps Profile.version. Source was 1.3.1 ->
    // 1.3.2 after the auto-version-entry synthesis.
    expect(loaded?.version).toBe('1.3.2');
  });

  it('preserves profileType when parsed baseData has no profileType', async () => {
    const parseResult = emptyParseResult({
      profile: {
        baseData: {
          weightHistory: [],
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
        },
        warningSigns: [],
        externalReferences: [],
        version: '1.0',
      },
    });
    await importProfile(parseResult, profileId);
    const profileRepo = new ProfileRepository();
    const loaded = await profileRepo.getById(profileId);
    expect(loaded?.baseData.profileType).toBe('self');
  });

  it('merge falls back to existing values when parsed fields are absent', async () => {
    // Seed the existing profile with data that should survive the merge
    const profileRepo = new ProfileRepository();
    await profileRepo.update(profileId, {
      baseData: {
        name: 'Mein Profil',
        weightHistory: [{ date: '2025-01-01', weightKg: 80 }],
        knownDiagnoses: ['Asthma'],
        currentMedications: ['Ibuprofen'],
        relevantLimitations: ['Keine Spruenge'],
        profileType: 'proxy',
        managedBy: 'Tochter',
      },
      warningSigns: ['Schwindel'],
      externalReferences: ['https://example.com'],
      lastUpdateReason: 'Ersterfassung',
    });

    // Parse result with all fallback-relevant fields explicitly undefined.
    // The merge logic uses `??` to fall back to existing values when
    // parsed fields are absent. Cast needed because ParsedBaseData
    // declares arrays as required; at runtime the parser can produce
    // undefined when a section is missing from the source Markdown.
    const parseResult = emptyParseResult({
      profile: {
        baseData: {
          weightHistory: undefined as unknown as [],
          knownDiagnoses: undefined as unknown as string[],
          currentMedications: undefined as unknown as string[],
          relevantLimitations: undefined as unknown as string[],
          // managedBy deliberately omitted (already optional)
        },
        warningSigns: [], // empty array -> falls back to existing
        externalReferences: [], // empty array -> falls back to existing
        version: '2.0',
        // No lastUpdateReason -> falls back to existing
      },
    });
    await importProfile(parseResult, profileId);

    const loaded = await profileRepo.getById(profileId);
    // All ?? fields should have preserved the existing values
    expect(loaded?.baseData.managedBy).toBe('Tochter');
    expect(loaded?.baseData.weightHistory).toEqual([{ date: '2025-01-01', weightKg: 80 }]);
    expect(loaded?.baseData.currentMedications).toEqual(['Ibuprofen']);
    expect(loaded?.baseData.relevantLimitations).toEqual(['Keine Spruenge']);
    expect(loaded?.lastUpdateReason).toBe('Ersterfassung');
    // Array fields with .length > 0 check: empty parsed -> keep existing
    expect(loaded?.warningSigns).toEqual(['Schwindel']);
    expect(loaded?.externalReferences).toEqual(['https://example.com']);
  });

  it('throws when target profile does not exist', async () => {
    const parseResult = emptyParseResult({ observations: [obs('x')] });
    await expect(importProfile(parseResult, 'does-not-exist')).rejects.toThrow(/not found/i);
  });

  it('throws clearly when the key store is locked', async () => {
    lock();
    const parseResult = emptyParseResult({ observations: [obs('x')] });
    await expect(importProfile(parseResult, profileId)).rejects.toThrow();
  });

  it('succeeds when parse result is otherwise empty but has a profile update', async () => {
    const parseResult = emptyParseResult({
      profile: {
        baseData: {
          weightHistory: [],
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          weightKg: 85,
        },
        warningSigns: [],
        externalReferences: [],
        version: '1.1',
      },
    });
    const result = await importProfile(parseResult, profileId);
    expect(result.created.observations).toBe(0);
    const profileRepo = new ProfileRepository();
    const loaded = await profileRepo.getById(profileId);
    expect(loaded?.baseData.weightKg).toBe(85);
    // IM-04: import bumps Profile.version. Source was 1.1 -> 1.2.
    expect(loaded?.version).toBe('1.2');
  });

  it('throws and rolls back when a mismatched lab value reportIndex is present', async () => {
    const parseResult = emptyParseResult({
      labReports: [{ reportDate: '2026-01-01', labName: 'A', categoryAssessments: {} }],
      labValues: [{ reportIndex: 5, reportId: '', category: 'c', parameter: 'p', result: 'r' }],
    });

    await expect(importProfile(parseResult, profileId)).rejects.toThrow(/reportIndex/);

    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const reports = await labReportRepo.listByProfile(profileId);
    expect(reports).toHaveLength(0); // rolled back via pre-encrypt failure
  });

  it('rolls back on mid-transaction failure', async () => {
    const parseResult = emptyParseResult({
      observations: [obs('A')],
      supplements: [{ name: 'S', category: 'daily' }],
    });

    const bulkPutSpy = vi
      .spyOn(db.supplements, 'bulkPut')
      .mockRejectedValueOnce(new Error('disk full'));

    await expect(importProfile(parseResult, profileId)).rejects.toThrow('disk full');

    const obsRepo = new ObservationRepository();
    const observationsAfter = await obsRepo.listByProfile(profileId);
    expect(observationsAfter).toHaveLength(0); // transaction rolled back

    bulkPutSpy.mockRestore();
  });

  it('handles parseResult with zero entities end-to-end', async () => {
    const parseResult = emptyParseResult();
    const result = await importProfile(parseResult, profileId);
    expect(result.created).toEqual({
      observations: 0,
      labReports: 0,
      labValues: 0,
      supplements: 0,
      openPoints: 0,
      // IM-04: even with zero parsed entities the import gesture
      // itself emits the synthesized "Profil aus Datei importiert"
      // ProfileVersion row.
      profileVersions: 1,
      timelineEntries: 0,
    });
  });

  it('bumps updatedAt on the target profile even with null parsed profile', async () => {
    const profileRepo = new ProfileRepository();
    const before = await profileRepo.getById(profileId);
    await new Promise((r) => setTimeout(r, 5));

    await importProfile(emptyParseResult(), profileId);
    const after = await profileRepo.getById(profileId);
    expect(after?.updatedAt).toBeGreaterThan(before?.updatedAt ?? 0);
  });

  it('replace deletes old entities of all types', async () => {
    const obsRepo = new ObservationRepository();
    const suppRepo = new SupplementRepository();
    const opRepo = new OpenPointRepository();
    await obsRepo.create({
      profileId,
      theme: 'Old',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });
    await suppRepo.create({ profileId, name: 'OldS', category: 'daily' });
    await opRepo.create({ profileId, text: 'old', context: 'ctx', resolved: false });

    await importProfile(emptyParseResult({ observations: [obs('New')] }), profileId, {
      replaceExisting: true,
    });

    expect((await obsRepo.listByProfile(profileId)).map((o) => o.theme)).toEqual(['New']);
    expect(await suppRepo.listByProfile(profileId)).toHaveLength(0);
    expect(await opRepo.listByProfile(profileId)).toHaveLength(0);
  });

  // IM-04: every successful import emits one synthesized
  // ProfileVersion row recording the import gesture itself, alongside
  // any rows lifted from the source markdown's Versionshistorie.
  describe('IM-04 auto-version-entry', () => {
    it('synthesizes a ProfileVersion row with the import-marker description', async () => {
      const versionRepo = new ProfileVersionRepository();

      await importProfile(emptyParseResult(), profileId);

      const versions = await versionRepo.listByProfile(profileId);
      expect(versions).toHaveLength(1);
      expect(versions[0]?.changeDescription).toBe('Profil aus Datei importiert');
      expect(versions[0]?.changeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('bumps Profile.version on the imported profile and uses the bumped value on the synthesized row', async () => {
      const profileRepo = new ProfileRepository();
      const versionRepo = new ProfileVersionRepository();

      await importProfile(emptyParseResult(), profileId);

      const profile = await profileRepo.getById(profileId);
      // Pre-test profile is created with version "1.0" (beforeEach
      // setup); bumpVersion("1.0") => "1.1".
      expect(profile?.version).toBe('1.1');
      const versions = await versionRepo.listByProfile(profileId);
      expect(versions[0]?.version).toBe('1.1');
    });

    it('appends the synthesized row to versions lifted from the source markdown', async () => {
      const versionRepo = new ProfileVersionRepository();

      await importProfile(
        emptyParseResult({
          profileVersions: [
            { version: '0.9', changeDescription: 'Initial', changeDate: '2026-01-01' },
            { version: '1.0', changeDescription: 'Update', changeDate: '2026-02-01' },
          ],
        }),
        profileId,
      );

      const versions = await versionRepo.listByProfile(profileId);
      expect(versions).toHaveLength(3);
      const descriptions = versions.map((v) => v.changeDescription).sort();
      expect(descriptions).toEqual(['Initial', 'Profil aus Datei importiert', 'Update']);
    });

    it('replaceExisting: synthesized row survives the delete + re-insert pass', async () => {
      const versionRepo = new ProfileVersionRepository();
      // Pre-existing version row that should be wiped by replace.
      await versionRepo.create({
        profileId,
        version: '0.5',
        changeDescription: 'Old',
        changeDate: '2025-12-01',
      });

      await importProfile(emptyParseResult(), profileId, { replaceExisting: true });

      const versions = await versionRepo.listByProfile(profileId);
      expect(versions).toHaveLength(1);
      expect(versions[0]?.changeDescription).toBe('Profil aus Datei importiert');
    });
  });

  // IM-05: per-type selective replace via the object form of
  // `replaceExisting`. Each test seeds a non-empty target profile,
  // imports with a per-type map, and asserts only the selected types
  // were replaced while others were preserved.
  describe('IM-05 selective per-type replace', () => {
    async function seedTarget(): Promise<void> {
      const obsRepo = new ObservationRepository();
      const suppRepo = new SupplementRepository();
      const opRepo = new OpenPointRepository();
      await obsRepo.create({
        profileId,
        theme: 'OldTheme',
        fact: 'old fact',
        pattern: 'old pattern',
        selfRegulation: 'old self',
        status: 'Stabil',
        source: 'user',
        extraSections: {},
      });
      await suppRepo.create({ profileId, name: 'OldSupp', category: 'daily' });
      await opRepo.create({ profileId, text: 'old', context: 'ctx', resolved: false });
    }

    it('observations=true keeps everything else, replaces only observations', async () => {
      await seedTarget();
      const obsRepo = new ObservationRepository();
      const suppRepo = new SupplementRepository();
      const opRepo = new OpenPointRepository();
      const result = await importProfile(
        emptyParseResult({ observations: [obs('NewTheme')] }),
        profileId,
        { replaceExisting: { observations: true } },
      );
      expect(result.replaced).toBe(true);
      expect(result.created.observations).toBe(1);
      expect(result.created.supplements).toBe(0);
      expect(result.created.openPoints).toBe(0);
      // Observations replaced.
      const obs2 = await obsRepo.listByProfile(profileId);
      expect(obs2.map((o) => o.theme)).toEqual(['NewTheme']);
      // Other types preserved.
      const supps = await suppRepo.listByProfile(profileId);
      expect(supps.map((s) => s.name)).toEqual(['OldSupp']);
      const ops = await opRepo.listByProfile(profileId);
      expect(ops.map((o) => o.text)).toEqual(['old']);
    });

    it('all-false on a non-empty target throws ImportTargetNotEmptyError', async () => {
      await seedTarget();
      await expect(
        importProfile(emptyParseResult({ observations: [obs('NewTheme')] }), profileId, {
          replaceExisting: {},
        }),
      ).rejects.toBeInstanceOf(ImportTargetNotEmptyError);
    });

    it('all-false on an empty target writes nothing (object form is strict per-type)', async () => {
      // Empty profile + replaceExisting:{} = user explicitly opted
      // out of all type replacements. Per Option A semantics
      // ("replace or preserve" only), skipped types drop their
      // imported rows. Result: nothing written, including the
      // observations from the parse result. Legacy boolean /
      // undefined behaviour is preserved separately for callers
      // that pass nothing.
      const obsRepo = new ObservationRepository();
      const result = await importProfile(
        emptyParseResult({ observations: [obs('Fresh')] }),
        profileId,
        { replaceExisting: {} },
      );
      expect(result.replaced).toBe(false);
      expect(result.created.observations).toBe(0);
      const stored = await obsRepo.listByProfile(profileId);
      expect(stored).toHaveLength(0);
    });

    it('labData=true replaces both LabReport and LabValue (Q6 grouping)', async () => {
      await seedTarget();
      // Seed a lab report with a value to verify both wipe.
      const labReportRepo = new LabReportRepository(new LabValueRepository());
      const seededReport = await labReportRepo.create({
        profileId,
        reportDate: '2024-01-01',
        categoryAssessments: {},
      });
      const labValueRepo = new LabValueRepository();
      await labValueRepo.create({
        profileId,
        reportId: seededReport.id,
        category: 'Old',
        parameter: 'OldParam',
        result: 'x',
      });

      await importProfile(
        emptyParseResult({
          labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
          labValues: [
            { reportIndex: 0, reportId: '', category: 'New', parameter: 'NewParam', result: 'y' },
          ],
        }),
        profileId,
        { replaceExisting: { labData: true } },
      );

      const reports = await labReportRepo.listByProfileDateDescending(profileId);
      expect(reports.map((r) => r.reportDate)).toEqual(['2026-04-15']);
      const values = await labValueRepo.listByProfile(profileId);
      expect(values.map((v) => v.parameter)).toEqual(['NewParam']);
    });

    it('profileVersions=false still synthesizes the import-marker row (Q5)', async () => {
      const versionRepo = new ProfileVersionRepository();
      // Seed an existing ProfileVersion row that the user wants to
      // preserve. Choose a version different from the bumped value
      // so they don't collide.
      await versionRepo.create({
        profileId,
        version: '0.5',
        changeDescription: 'Existing snapshot',
        changeDate: '2025-12-01',
      });
      await seedTarget();

      await importProfile(
        emptyParseResult({
          profileVersions: [
            { version: '0.9', changeDescription: 'From source', changeDate: '2026-01-01' },
          ],
        }),
        profileId,
        // Authorise observations only so the throw guard passes; the
        // profileVersions flag is left false explicitly.
        { replaceExisting: { observations: true, profileVersions: false } },
      );

      const versions = await versionRepo.listByProfile(profileId);
      // Existing 0.5 row preserved; synthesized marker added; the
      // parsed 0.9 row is dropped (not authorised).
      const descriptions = versions.map((v) => v.changeDescription).sort();
      expect(descriptions).toEqual(['Existing snapshot', 'Profil aus Datei importiert']);
    });

    it('profileVersions=true wipes existing rows AND writes parsed + synthesized', async () => {
      const versionRepo = new ProfileVersionRepository();
      await versionRepo.create({
        profileId,
        version: '0.5',
        changeDescription: 'Existing snapshot',
        changeDate: '2025-12-01',
      });

      await importProfile(
        emptyParseResult({
          profileVersions: [
            { version: '0.9', changeDescription: 'From source', changeDate: '2026-01-01' },
          ],
        }),
        profileId,
        { replaceExisting: { profileVersions: true } },
      );

      const versions = await versionRepo.listByProfile(profileId);
      const descriptions = versions.map((v) => v.changeDescription).sort();
      expect(descriptions).toEqual(['From source', 'Profil aus Datei importiert']);
    });

    it('mixed map: observations replaced, supplements skipped, ops skipped', async () => {
      await seedTarget();
      const obsRepo = new ObservationRepository();
      const suppRepo = new SupplementRepository();
      const opRepo = new OpenPointRepository();

      await importProfile(
        emptyParseResult({
          observations: [obs('NewObs')],
          supplements: [{ name: 'NewSupp', category: 'daily' }],
          openPoints: [{ text: 'new op', context: 'ctx', resolved: false }],
        }),
        profileId,
        { replaceExisting: { observations: true } },
      );

      // Only observations changed.
      expect((await obsRepo.listByProfile(profileId)).map((o) => o.theme)).toEqual(['NewObs']);
      expect((await suppRepo.listByProfile(profileId)).map((s) => s.name)).toEqual(['OldSupp']);
      expect((await opRepo.listByProfile(profileId)).map((o) => o.text)).toEqual(['old']);
    });
  });

  // IM-05 Option B (2026-05-01): three modes per type — replace, add,
  // skip. Tests cover the new 'add' path and the type-string form of
  // PerTypeMode while the legacy boolean form remains green via the
  // describe block above.
  describe('IM-05 Option B three-mode (add path + string form)', () => {
    async function seedTarget(): Promise<void> {
      const obsRepo = new ObservationRepository();
      await obsRepo.create({
        profileId,
        theme: 'OldTheme',
        fact: 'old fact',
        pattern: 'old pattern',
        selfRegulation: 'old self',
        status: 'Stabil',
        source: 'user',
        extraSections: {},
      });
    }

    it("observations='add' keeps existing AND writes imported (both coexist)", async () => {
      await seedTarget();
      const obsRepo = new ObservationRepository();

      const result = await importProfile(
        emptyParseResult({ observations: [obs('NewTheme')] }),
        profileId,
        { replaceExisting: { observations: 'add' } },
      );

      // `replaced=false` because no existing rows were deleted; only
      // 'replace' counts toward the replaced field semantic.
      expect(result.replaced).toBe(false);
      expect(result.created.observations).toBe(1);

      const stored = await obsRepo.listByProfile(profileId);
      const themes = stored.map((o) => o.theme).sort();
      expect(themes).toEqual(['NewTheme', 'OldTheme']);
    });

    it("observations='replace' explicit string form deletes existing then writes imported", async () => {
      await seedTarget();
      const obsRepo = new ObservationRepository();

      const result = await importProfile(
        emptyParseResult({ observations: [obs('NewTheme')] }),
        profileId,
        { replaceExisting: { observations: 'replace' } },
      );

      expect(result.replaced).toBe(true);
      expect(result.created.observations).toBe(1);
      const stored = await obsRepo.listByProfile(profileId);
      expect(stored.map((o) => o.theme)).toEqual(['NewTheme']);
    });

    it("observations='skip' keeps existing AND drops imported", async () => {
      await seedTarget();
      const obsRepo = new ObservationRepository();

      // Pair with another type set to 'replace' so the throw guard
      // passes; supplements has no existing data, so 'replace' is a
      // no-op delete + write.
      const result = await importProfile(
        emptyParseResult({
          observations: [obs('Dropped')],
          supplements: [{ name: 'NewSupp', category: 'daily' }],
        }),
        profileId,
        { replaceExisting: { observations: 'skip', supplements: 'replace' } },
      );

      expect(result.created.observations).toBe(0);
      expect(result.created.supplements).toBe(1);
      const stored = await obsRepo.listByProfile(profileId);
      expect(stored.map((o) => o.theme)).toEqual(['OldTheme']);
    });

    it("labData='add' keeps existing reports + values AND writes imported with FK consistency", async () => {
      const labReportRepo = new LabReportRepository(new LabValueRepository());
      const labValueRepo = new LabValueRepository();
      const seededReport = await labReportRepo.create({
        profileId,
        reportDate: '2024-01-01',
        labName: 'OldLab',
        categoryAssessments: {},
      });
      await labValueRepo.create({
        profileId,
        reportId: seededReport.id,
        category: 'Old',
        parameter: 'OldParam',
        result: 'x',
      });

      await importProfile(
        emptyParseResult({
          labReports: [{ reportDate: '2026-04-15', labName: 'NewLab', categoryAssessments: {} }],
          labValues: [
            {
              reportIndex: 0,
              reportId: '',
              category: 'New',
              parameter: 'NewParam',
              result: 'y',
            },
          ],
        }),
        profileId,
        { replaceExisting: { labData: 'add' } },
      );

      const reports = await labReportRepo.listByProfileDateDescending(profileId);
      expect(reports.map((r) => r.labName).sort()).toEqual(['NewLab', 'OldLab']);
      const newReport = reports.find((r) => r.labName === 'NewLab');
      const oldReport = reports.find((r) => r.labName === 'OldLab');
      expect(newReport).toBeDefined();
      expect(oldReport).toBeDefined();

      // FK consistency: each value points at its own report. The new
      // value's reportId matches the new report; the old value's
      // reportId still matches the old report.
      const values = await labValueRepo.listByProfile(profileId);
      expect(values).toHaveLength(2);
      const newValue = values.find((v) => v.parameter === 'NewParam');
      const oldValue = values.find((v) => v.parameter === 'OldParam');
      expect(newValue?.reportId).toBe(newReport?.id);
      expect(oldValue?.reportId).toBe(oldReport?.id);
    });

    it("profileVersions='add' keeps existing + writes parsed source + synthesized marker", async () => {
      const versionRepo = new ProfileVersionRepository();
      await versionRepo.create({
        profileId,
        version: '0.5',
        changeDescription: 'Existing snapshot',
        changeDate: '2025-12-01',
      });

      await importProfile(
        emptyParseResult({
          profileVersions: [
            { version: '0.9', changeDescription: 'From source', changeDate: '2026-01-01' },
          ],
        }),
        profileId,
        { replaceExisting: { profileVersions: 'add' } },
      );

      const versions = await versionRepo.listByProfile(profileId);
      const descriptions = versions.map((v) => v.changeDescription).sort();
      expect(descriptions).toEqual([
        'Existing snapshot',
        'From source',
        'Profil aus Datei importiert',
      ]);
    });

    it('any-add authorises the throw guard (non-empty target writes succeed)', async () => {
      await seedTarget();
      const obsRepo = new ObservationRepository();

      // 'add' alone authorises a write to a non-empty target. The
      // throw guard fires only when no key is replace OR add.
      const result = await importProfile(
        emptyParseResult({ observations: [obs('Extra')] }),
        profileId,
        { replaceExisting: { observations: 'add' } },
      );
      expect(result.created.observations).toBe(1);
      const stored = await obsRepo.listByProfile(profileId);
      expect(stored.map((o) => o.theme).sort()).toEqual(['Extra', 'OldTheme']);
    });

    it('all-skip on a non-empty target throws ImportTargetNotEmptyError', async () => {
      await seedTarget();
      await expect(
        importProfile(emptyParseResult({ observations: [obs('Whatever')] }), profileId, {
          replaceExisting: { observations: 'skip' },
        }),
      ).rejects.toBeInstanceOf(ImportTargetNotEmptyError);
    });

    it('same MD imported twice with all-add yields two copies of every entity (duplicate hint case)', async () => {
      const obsRepo = new ObservationRepository();
      // First import: empty target, replace works as no-op delete +
      // write. Two observations land.
      await importProfile(emptyParseResult({ observations: [obs('A'), obs('B')] }), profileId, {
        replaceExisting: true,
      });
      expect(await obsRepo.listByProfile(profileId)).toHaveLength(2);

      // Second import with 'add' against the now-non-empty target:
      // both old and new survive. Total goes to 4 (the duplicate
      // hint case the ConfirmDialog warning calls out).
      await importProfile(emptyParseResult({ observations: [obs('A'), obs('B')] }), profileId, {
        replaceExisting: { observations: 'add' },
      });
      const stored = await obsRepo.listByProfile(profileId);
      expect(stored).toHaveLength(4);
      const themes = stored.map((o) => o.theme).sort();
      expect(themes).toEqual(['A', 'A', 'B', 'B']);
    });

    it('mixed three-mode map: replace observations, add supplements, skip openPoints', async () => {
      await seedTarget();
      const suppRepo = new SupplementRepository();
      const opRepo = new OpenPointRepository();
      await suppRepo.create({ profileId, name: 'OldSupp', category: 'daily' });
      await opRepo.create({ profileId, text: 'old op', context: 'ctx', resolved: false });

      const obsRepo = new ObservationRepository();
      await importProfile(
        emptyParseResult({
          observations: [obs('NewObs')],
          supplements: [{ name: 'NewSupp', category: 'daily' }],
          openPoints: [{ text: 'new op', context: 'ctx', resolved: false }],
        }),
        profileId,
        {
          replaceExisting: {
            observations: 'replace',
            supplements: 'add',
            openPoints: 'skip',
          },
        },
      );

      // Observations: replaced => only NewObs.
      expect((await obsRepo.listByProfile(profileId)).map((o) => o.theme)).toEqual(['NewObs']);
      // Supplements: added => OldSupp + NewSupp coexist.
      expect((await suppRepo.listByProfile(profileId)).map((s) => s.name).sort()).toEqual([
        'NewSupp',
        'OldSupp',
      ]);
      // Open points: skipped => only old.
      expect((await opRepo.listByProfile(profileId)).map((o) => o.text)).toEqual(['old op']);
    });
  });
});
