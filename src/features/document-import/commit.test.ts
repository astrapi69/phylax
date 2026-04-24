import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import {
  LabReportRepository,
  LabValueRepository,
  ObservationRepository,
  ProfileRepository,
} from '../../db/repositories';
import { commitDrafts, isSelectionEmpty, totalCommitted } from './commit';
import type { DraftSelection } from './commit';
import type { ExtractedDrafts } from './drafts';

const TEST_PASSWORD = 'test-password-12';

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function ensureProfile(): Promise<string> {
  const repo = new ProfileRepository();
  const existing = await repo.getCurrentProfile();
  if (existing) return existing.id;
  const created = await repo.create({
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
  return created.id;
}

function fullDrafts(): ExtractedDrafts {
  return {
    observations: [
      {
        theme: 'Schulter',
        fact: 'Schmerz beim Heben',
        pattern: 'Unter Belastung',
        selfRegulation: 'Krafttraining',
        status: 'in Besserung',
        source: 'ai',
        extraSections: {},
      },
    ],
    labValues: [
      {
        category: 'Blutbild',
        parameter: 'Haemoglobin',
        result: '14.2',
        unit: 'g/dl',
        referenceRange: '13.5-17.5',
        assessment: 'normal',
      },
      {
        category: 'Schilddrüse',
        parameter: 'TSH',
        result: '1.5',
        unit: 'mU/l',
      },
    ],
    supplements: [
      {
        name: 'Vitamin D3 2000 IE',
        category: 'daily',
      },
    ],
    openPoints: [
      {
        text: 'Wiederholungs-Blutabnahme',
        context: 'In 3 Monaten',
        resolved: false,
      },
    ],
    labReportMeta: {
      reportDate: '2026-04-14',
      labName: 'Synlab MVZ',
    },
  };
}

const ALL_SELECTED: DraftSelection = {
  observations: [0],
  labValues: [0, 1],
  supplements: [0],
  openPoints: [0],
};

const COMMIT_OPTS = { sourceFileName: 'lab-2026-04.pdf' };

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('commitDrafts', () => {
  it('aborts with no-profile when no profile exists', async () => {
    const result = await commitDrafts(fullDrafts(), ALL_SELECTED, COMMIT_OPTS);
    expect(result.abortError).toBe('no-profile');
    expect(totalCommitted(result)).toBe(0);
  });

  it('writes selected drafts of every type and returns per-type tallies', async () => {
    await ensureProfile();
    const result = await commitDrafts(fullDrafts(), ALL_SELECTED, COMMIT_OPTS);

    expect(result.abortError).toBeNull();
    expect(result.observations).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
    expect(result.labValues).toEqual({ attempted: 2, succeeded: 2, failed: 0 });
    expect(result.supplements).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
    expect(result.openPoints).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
    expect(totalCommitted(result)).toBe(5);
    expect(result.labReportId).not.toBeNull();
  });

  it('synthesizes a LabReport that lab values reference', async () => {
    const profileId = await ensureProfile();
    const result = await commitDrafts(fullDrafts(), ALL_SELECTED, COMMIT_OPTS);
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    expect(reports).toHaveLength(1);
    const report = reports[0];
    if (!report) throw new Error('expected report');
    expect(report.id).toBe(result.labReportId);
    expect(report.reportDate).toBe('2026-04-14');
    expect(report.labName).toBe('Synlab MVZ');
    expect(report.contextNote).toBe('Importiert aus lab-2026-04.pdf');

    const values = await new LabValueRepository().listByProfile(profileId);
    expect(values).toHaveLength(2);
    expect(values.every((v) => v.reportId === report.id)).toBe(true);
  });

  it('falls back to today ISO date when reportDate is missing', async () => {
    await ensureProfile();
    const drafts = fullDrafts();
    drafts.labReportMeta = {};
    const fixedNow = new Date('2026-04-24T10:00:00Z');
    const result = await commitDrafts(drafts, ALL_SELECTED, {
      ...COMMIT_OPTS,
      now: () => fixedNow,
    });
    expect(result.labReportId).not.toBeNull();
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    if (!result.labReportId) throw new Error('expected report id');
    const report = await labReportRepo.getById(result.labReportId);
    expect(report?.reportDate).toBe('2026-04-24');
    expect(report?.labName).toBeUndefined();
  });

  it('skips lab-report synthesis when no lab values selected', async () => {
    const profileId = await ensureProfile();
    const drafts = fullDrafts();
    const selection: DraftSelection = { ...ALL_SELECTED, labValues: [] };
    const result = await commitDrafts(drafts, selection, COMMIT_OPTS);
    expect(result.labReportId).toBeNull();
    expect(result.labValues).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    expect(reports).toHaveLength(0);
  });

  it('only writes drafts whose indices appear in the selection', async () => {
    const profileId = await ensureProfile();
    const drafts = fullDrafts();
    const selection: DraftSelection = {
      observations: [],
      labValues: [1],
      supplements: [],
      openPoints: [0],
    };
    const result = await commitDrafts(drafts, selection, COMMIT_OPTS);
    expect(result.observations.attempted).toBe(0);
    expect(result.labValues).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
    expect(result.openPoints.succeeded).toBe(1);

    const values = await new LabValueRepository().listByProfile(profileId);
    expect(values).toHaveLength(1);
    expect(values[0]?.parameter).toBe('TSH');
  });

  it('ignores selection indices that are out of range', async () => {
    await ensureProfile();
    const drafts = fullDrafts();
    const selection: DraftSelection = {
      observations: [99],
      labValues: [],
      supplements: [],
      openPoints: [],
    };
    const result = await commitDrafts(drafts, selection, COMMIT_OPTS);
    expect(result.observations).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
  });

  it('counts per-write failures without aborting later types', async () => {
    await ensureProfile();
    const drafts = fullDrafts();
    const failingObs = new ObservationRepository();
    failingObs.create = async () => {
      throw new Error('quota exceeded');
    };
    const result = await commitDrafts(drafts, ALL_SELECTED, {
      ...COMMIT_OPTS,
      repos: { observation: failingObs },
    });
    expect(result.observations).toEqual({ attempted: 1, succeeded: 0, failed: 1 });
    expect(result.supplements.succeeded).toBe(1);
    expect(result.openPoints.succeeded).toBe(1);
  });

  it('counts every selected lab value as failed when synthetic LabReport write fails', async () => {
    await ensureProfile();
    const labValueRepo = new LabValueRepository();
    const failingReport = new LabReportRepository(labValueRepo);
    failingReport.create = async () => {
      throw new Error('crypto failure');
    };
    const result = await commitDrafts(fullDrafts(), ALL_SELECTED, {
      ...COMMIT_OPTS,
      repos: { labReport: failingReport, labValue: labValueRepo },
    });
    expect(result.labValues).toEqual({ attempted: 2, succeeded: 0, failed: 2 });
    expect(result.labReportId).toBeNull();
    // Subsequent types still attempted (best-effort within pipeline).
    expect(result.supplements.succeeded).toBe(1);
    expect(result.openPoints.succeeded).toBe(1);
  });

  it('seeds the synthetic report contextNote with the source filename', async () => {
    await ensureProfile();
    const result = await commitDrafts(fullDrafts(), ALL_SELECTED, {
      sourceFileName: 'mein-laborbefund.pdf',
    });
    if (!result.labReportId) throw new Error('expected report');
    const report = await new LabReportRepository(new LabValueRepository()).getById(
      result.labReportId,
    );
    expect(report?.contextNote).toBe('Importiert aus mein-laborbefund.pdf');
  });

  it('writes nothing extra when selection is empty', async () => {
    await ensureProfile();
    const empty: DraftSelection = {
      observations: [],
      labValues: [],
      supplements: [],
      openPoints: [],
    };
    const result = await commitDrafts(fullDrafts(), empty, COMMIT_OPTS);
    expect(totalCommitted(result)).toBe(0);
    expect(result.labReportId).toBeNull();
  });
});

describe('isSelectionEmpty', () => {
  it('returns true when every array is empty', () => {
    expect(
      isSelectionEmpty({
        observations: [],
        labValues: [],
        supplements: [],
        openPoints: [],
      }),
    ).toBe(true);
  });

  it('returns false when any array has at least one entry', () => {
    expect(
      isSelectionEmpty({
        observations: [],
        labValues: [],
        supplements: [],
        openPoints: [3],
      }),
    ).toBe(false);
  });
});

describe('totalCommitted', () => {
  it('sums succeeded across all four types', () => {
    expect(
      totalCommitted({
        observations: { attempted: 3, succeeded: 2, failed: 1 },
        labValues: { attempted: 2, succeeded: 2, failed: 0 },
        supplements: { attempted: 1, succeeded: 1, failed: 0 },
        openPoints: { attempted: 1, succeeded: 0, failed: 1 },
        labReportId: 'r',
        abortError: null,
      }),
    ).toBe(5);
  });
});
