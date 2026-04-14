import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import {
  ProfileRepository,
  ObservationRepository,
  LabReportRepository,
  LabValueRepository,
} from '../../../db/repositories';
import { countEntities } from './countEntities';
import { EMPTY_COUNTS, countsAreEmpty } from './types';

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

describe('countEntities', () => {
  it('returns zeros for an empty profile', async () => {
    const counts = await countEntities(profileId);
    expect(counts).toEqual(EMPTY_COUNTS);
    expect(countsAreEmpty(counts)).toBe(true);
  });

  it('counts observations correctly', async () => {
    const repo = new ObservationRepository();
    await repo.create({
      profileId,
      theme: 'Knie',
      fact: 'Schmerz',
      pattern: 'Belastung',
      selfRegulation: 'Training',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    await repo.create({
      profileId,
      theme: 'Schulter',
      fact: 'Schmerz',
      pattern: 'Druck',
      selfRegulation: 'Uebungen',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });

    const counts = await countEntities(profileId);
    expect(counts.observations).toBe(2);
    expect(countsAreEmpty(counts)).toBe(false);
  });

  it('counts lab reports and lab values separately', async () => {
    const labValueRepo = new LabValueRepository();
    const labReportRepo = new LabReportRepository(labValueRepo);

    const report = await labReportRepo.create({
      profileId,
      reportDate: '2026-01-01',
      labName: 'Testlabor',
      categoryAssessments: {},
    });
    await labValueRepo.create({
      profileId,
      reportId: report.id,
      category: 'Blutbild',
      parameter: 'Hb',
      result: '14.2',
    });

    const counts = await countEntities(profileId);
    expect(counts.labReports).toBe(1);
    expect(counts.labValues).toBe(1);
  });

  it('does not count entities of other profiles', async () => {
    const profileRepo = new ProfileRepository();
    const other = await profileRepo.create({
      baseData: {
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

    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId: other.id,
      theme: 'Other',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const counts = await countEntities(profileId);
    expect(counts.observations).toBe(0);
  });
});
