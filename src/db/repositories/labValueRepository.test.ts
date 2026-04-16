import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { LabValueRepository } from './labValueRepository';
import type { LabValue } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let repo: LabValueRepository;

function makeValueData(
  overrides: Partial<Omit<LabValue, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<LabValue, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    reportId: overrides.reportId ?? 'report-1',
    category: overrides.category ?? 'Blutbild',
    parameter: overrides.parameter ?? 'Haemoglobin',
    result: overrides.result ?? '14.2',
    unit: overrides.unit,
    referenceRange: overrides.referenceRange,
    assessment: overrides.assessment,
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
  repo = new LabValueRepository();
});

describe('LabValueRepository', () => {
  it('round-trips all fields', async () => {
    const data = makeValueData({
      reportId: 'report-abc',
      category: 'Nierenwerte',
      parameter: 'Kreatinin',
      result: '0.95',
      unit: 'mg/dl',
      referenceRange: '0.67-1.17',
      assessment: 'normal',
    });
    const created = await repo.create(data);
    const fetched = await repo.getById(created.id);

    expect(fetched?.reportId).toBe('report-abc');
    expect(fetched?.category).toBe('Nierenwerte');
    expect(fetched?.parameter).toBe('Kreatinin');
    expect(fetched?.result).toBe('0.95');
    expect(fetched?.unit).toBe('mg/dl');
    expect(fetched?.referenceRange).toBe('0.67-1.17');
    expect(fetched?.assessment).toBe('normal');
    lock();
  });

  it('non-numeric result strings preserved', async () => {
    const nonNumeric = ['negativ', '>100', '1:40', '<0.5'];
    for (const result of nonNumeric) {
      const v = await repo.create(makeValueData({ result }));
      const fetched = await repo.getById(v.id);
      expect(fetched?.result).toBe(result);
    }
    lock();
  });

  it('decimal formatting preserved', async () => {
    const decimals = ['14,2', '14.2', '0,050', '.5'];
    for (const result of decimals) {
      const v = await repo.create(makeValueData({ result }));
      const fetched = await repo.getById(v.id);
      expect(fetched?.result).toBe(result);
    }
    lock();
  });

  it('optional fields undefined when absent', async () => {
    const v = await repo.create(makeValueData());
    const fetched = await repo.getById(v.id);

    expect(fetched?.unit).toBeUndefined();
    expect(fetched?.referenceRange).toBeUndefined();
    expect(fetched?.assessment).toBeUndefined();
    lock();
  });

  it('listByReport filters correctly', async () => {
    await repo.create(makeValueData({ reportId: 'rA' }));
    await repo.create(makeValueData({ reportId: 'rA' }));
    await repo.create(makeValueData({ reportId: 'rA' }));
    await repo.create(makeValueData({ reportId: 'rB' }));
    await repo.create(makeValueData({ reportId: 'rB' }));

    const result = await repo.listByReport('rA');
    expect(result).toHaveLength(3);
    for (const v of result) {
      expect(v.reportId).toBe('rA');
    }
    lock();
  });

  it('listByReport unknown reportId returns empty', async () => {
    await repo.create(makeValueData({ reportId: 'rA' }));
    const result = await repo.listByReport('nonexistent');
    expect(result).toEqual([]);
    lock();
  });

  it('listByParameter filters and sorts chronologically', async () => {
    const v1 = await repo.create(makeValueData({ parameter: 'Kreatinin', result: '0.90' }));
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    const v2 = await repo.create(makeValueData({ parameter: 'Kreatinin', result: '0.95' }));
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    const v3 = await repo.create(makeValueData({ parameter: 'Kreatinin', result: '1.00' }));
    // Also create a value for a different parameter
    await repo.create(makeValueData({ parameter: 'Haemoglobin', result: '14.2' }));

    const result = await repo.listByParameter(profileId, 'Kreatinin');
    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe(v1.id);
    expect(result[1]?.id).toBe(v2.id);
    expect(result[2]?.id).toBe(v3.id);
    // Relational assertion: ascending createdAt order enforced by the sort
    const t0 = result[0]?.createdAt ?? 0;
    const t1 = result[1]?.createdAt ?? 0;
    const t2 = result[2]?.createdAt ?? 0;
    expect(t0).toBeLessThan(t1);
    expect(t1).toBeLessThan(t2);
    lock();
  });

  it('listByParameter empty for unknown parameter', async () => {
    await repo.create(makeValueData({ parameter: 'Kreatinin' }));
    const result = await repo.listByParameter(profileId, 'Nonexistent');
    expect(result).toEqual([]);
    lock();
  });

  it('listByParameter isolated by profileId', async () => {
    await repo.create(makeValueData({ profileId, parameter: 'Kreatinin' }));
    await repo.create(makeValueData({ profileId: 'other-profile', parameter: 'Kreatinin' }));

    const result = await repo.listByParameter(profileId, 'Kreatinin');
    expect(result).toHaveLength(1);
    expect(result[0]?.profileId).toBe(profileId);
    lock();
  });

  it('category free text preserved', async () => {
    const categories = ['Blutbild', 'Nierenwerte', 'Stoffwechsel', 'Lipide', 'Schilddruese'];
    for (const category of categories) {
      const v = await repo.create(makeValueData({ category }));
      const fetched = await repo.getById(v.id);
      expect(fetched?.category).toBe(category);
    }
    lock();
  });

  it('duplicate parameter in same report both survive', async () => {
    await repo.create(makeValueData({ reportId: 'r1', parameter: 'IgG', result: '1:40' }));
    await repo.create(makeValueData({ reportId: 'r1', parameter: 'IgG', result: '1:80' }));

    const result = await repo.listByReport('r1');
    expect(result).toHaveLength(2);
    const results = result.map((v) => v.result).sort();
    expect(results).toEqual(['1:40', '1:80']);
    lock();
  });

  it('inherited base class behaviors', async () => {
    const before = Date.now();
    const v = await repo.create(makeValueData());
    expect(v.id).toMatch(/^[0-9a-f]{8}-/);
    expect(v.createdAt).toBeGreaterThanOrEqual(before);

    await expect(repo.update(v.id, { id: 'new' } as Partial<LabValue>)).rejects.toThrow(
      'Cannot modify immutable fields',
    );

    lock();
  });
});
