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
      profileVersions: 1,
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
    expect(loaded?.version).toBe('1.3.1');
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
    expect(loaded?.version).toBe('1.1');
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
      profileVersions: 0,
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
});
