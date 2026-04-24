import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { LabValueRepository } from './labValueRepository';
import { LabReportRepository } from './labReportRepository';
import type { LabReport, LabValue } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let labValueRepo: LabValueRepository;
let repo: LabReportRepository;

function makeReportData(
  overrides: Partial<Omit<LabReport, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<LabReport, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    reportDate: overrides.reportDate ?? '2026-03-15',
    labName: overrides.labName,
    doctorName: overrides.doctorName,
    reportNumber: overrides.reportNumber,
    contextNote: overrides.contextNote,
    categoryAssessments: overrides.categoryAssessments ?? {},
    overallAssessment: overrides.overallAssessment,
    relevanceNotes: overrides.relevanceNotes,
    sourceDocumentId: overrides.sourceDocumentId,
  };
}

function makeValueData(
  reportId: string,
  overrides: Partial<Omit<LabValue, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<LabValue, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    reportId,
    category: overrides.category ?? 'Blutbild',
    parameter: overrides.parameter ?? 'Haemoglobin',
    result: overrides.result ?? '14.2',
  };
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const { readMeta } = await import('../meta');
  const { unlock } = await import('../../crypto');
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
    version: '1.0.0',
  });
  profileId = profile.id;
  labValueRepo = new LabValueRepository();
  repo = new LabReportRepository(labValueRepo);
});

describe('LabReportRepository', () => {
  it('round-trips all fields', async () => {
    const data = makeReportData({
      reportDate: '2026-03-15',
      labName: 'Synlab',
      doctorName: 'Dr. Mueller',
      reportNumber: 'SYN-2026-12345',
      contextNote: 'Routinekontrolle, Ueberweisung vom Hausarzt',
      categoryAssessments: {
        Blutbild: 'Alle Werte im Normbereich.',
        Nierenwerte: 'Kreatinin leicht erhoht, kontrollbeduerftig.',
      },
      overallAssessment: 'Unauffaellig bis auf Nierenwerte.',
      relevanceNotes: 'Gewichtsreduktion koennte Nierenwerte verbessern.',
    });
    const created = await repo.create(data);
    const fetched = await repo.getById(created.id);

    expect(fetched?.reportDate).toBe('2026-03-15');
    expect(fetched?.labName).toBe('Synlab');
    expect(fetched?.doctorName).toBe('Dr. Mueller');
    expect(fetched?.reportNumber).toBe('SYN-2026-12345');
    expect(fetched?.contextNote).toBe('Routinekontrolle, Ueberweisung vom Hausarzt');
    expect(fetched?.categoryAssessments).toEqual(data.categoryAssessments);
    expect(fetched?.overallAssessment).toBe('Unauffaellig bis auf Nierenwerte.');
    expect(fetched?.relevanceNotes).toBe('Gewichtsreduktion koennte Nierenwerte verbessern.');
    lock();
  });

  it('categoryAssessments German keys and Markdown preserved', async () => {
    const assessments = {
      Blutbild: '- Haemoglobin: **normal**\n- Leukozyten: normal',
      Nierenwerte: '- Kreatinin: erhoht\n- GFR: grenzwertig',
      Stoffwechsel: 'Nuechternglukose im Normbereich. HbA1c nicht bestimmt.',
    };
    const report = await repo.create(makeReportData({ categoryAssessments: assessments }));
    const fetched = await repo.getById(report.id);

    expect(fetched?.categoryAssessments).toEqual(assessments);
    expect(Object.keys(fetched?.categoryAssessments ?? {})).toHaveLength(3);
    lock();
  });

  it('empty categoryAssessments survives as empty object', async () => {
    const report = await repo.create(makeReportData({ categoryAssessments: {} }));
    const fetched = await repo.getById(report.id);

    expect(fetched?.categoryAssessments).toEqual({});
    expect(fetched?.categoryAssessments).not.toBeUndefined();
    lock();
  });

  it('optional fields undefined when absent', async () => {
    const report = await repo.create(makeReportData());
    const fetched = await repo.getById(report.id);

    expect(fetched?.labName).toBeUndefined();
    expect(fetched?.doctorName).toBeUndefined();
    expect(fetched?.reportNumber).toBeUndefined();
    expect(fetched?.contextNote).toBeUndefined();
    expect(fetched?.overallAssessment).toBeUndefined();
    expect(fetched?.relevanceNotes).toBeUndefined();
    lock();
  });

  it('listByProfileDateDescending sorts correctly', async () => {
    // Use 6 entries created in ascending date order. fake-indexeddb
    // returns by UUID primary-key order which is random. With 6 entries,
    // there are 720 permutations and only 1 is the correct descending
    // order, so the probability of the no-sort mutant accidentally
    // passing is ~0.14% per run. Relational assertions double-check.
    const dates = [
      '2022-01-01',
      '2023-03-15',
      '2024-06-20',
      '2024-11-01',
      '2025-07-20',
      '2026-01-10',
    ];
    for (const d of dates) {
      await repo.create(makeReportData({ reportDate: d }));
    }

    const sorted = await repo.listByProfileDateDescending(profileId);
    expect(sorted).toHaveLength(6);
    const sortedDates = sorted.map((r) => r.reportDate);
    expect(sortedDates).toEqual([...dates].reverse());
    // Relational: every consecutive pair is strictly descending
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const current = sortedDates[i] ?? '';
      const next = sortedDates[i + 1] ?? '';
      expect(current > next).toBe(true);
    }
    lock();
  });

  it('listByProfileDateDescending empty profile returns empty', async () => {
    const result = await repo.listByProfileDateDescending(profileId);
    expect(result).toEqual([]);
    lock();
  });

  it('deleteWithValues removes report AND all values', async () => {
    const report = await repo.create(makeReportData());
    await labValueRepo.create(makeValueData(report.id, { parameter: 'Haemoglobin' }));
    await labValueRepo.create(makeValueData(report.id, { parameter: 'Leukozyten' }));
    await labValueRepo.create(makeValueData(report.id, { parameter: 'Thrombozyten' }));

    await repo.deleteWithValues(report.id);

    expect(await repo.getById(report.id)).toBeNull();
    expect(await labValueRepo.listByReport(report.id)).toEqual([]);
    lock();
  });

  it('deleteWithValues when report has no values', async () => {
    const report = await repo.create(makeReportData());
    await repo.deleteWithValues(report.id);

    expect(await repo.getById(report.id)).toBeNull();
    lock();
  });

  it('delete (non-cascade) removes only the report', async () => {
    const report = await repo.create(makeReportData());
    const v1 = await labValueRepo.create(makeValueData(report.id));
    const v2 = await labValueRepo.create(makeValueData(report.id));

    // Non-cascade delete: report gone, values remain (orphaned)
    await repo.delete(report.id);

    expect(await repo.getById(report.id)).toBeNull();
    expect(await labValueRepo.getById(v1.id)).not.toBeNull();
    expect(await labValueRepo.getById(v2.id)).not.toBeNull();
    lock();
  });

  it('deleteWithValues on unknown id does not throw', async () => {
    await expect(repo.deleteWithValues('nonexistent')).resolves.not.toThrow();
    lock();
  });

  it('inherited base class behaviors', async () => {
    const before = Date.now();
    const report = await repo.create(makeReportData());
    expect(report.id).toMatch(/^[0-9a-f]{8}-/);
    expect(report.createdAt).toBeGreaterThanOrEqual(before);

    await expect(repo.update(report.id, { id: 'new' } as Partial<LabReport>)).rejects.toThrow(
      'Cannot modify immutable fields',
    );

    lock();
  });

  it('multiple reports isolated by profileId', async () => {
    await repo.create(makeReportData({ profileId }));
    await repo.create(makeReportData({ profileId }));
    await repo.create(makeReportData({ profileId: 'other-profile' }));

    const result = await repo.listByProfile(profileId);
    expect(result).toHaveLength(2);
    lock();
  });

  describe('sourceDocumentId (IMP-05)', () => {
    it('round-trips when set', async () => {
      const r = await repo.create(makeReportData({ sourceDocumentId: 'doc-1' }));
      expect((await repo.getById(r.id))?.sourceDocumentId).toBe('doc-1');
    });

    it('listBySourceDocument filters correctly', async () => {
      await repo.create(makeReportData({ reportDate: '2026-01-01', sourceDocumentId: 'doc-1' }));
      await repo.create(makeReportData({ reportDate: '2026-02-01', sourceDocumentId: 'doc-2' }));
      await repo.create(makeReportData({ reportDate: '2026-03-01' }));

      const matched = await repo.listBySourceDocument('doc-1');
      expect(matched).toHaveLength(1);
      expect(matched[0]?.reportDate).toBe('2026-01-01');
    });
  });
});
