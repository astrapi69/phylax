import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { SupplementRepository } from './supplementRepository';
import type { Supplement, SupplementCategory } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let repo: SupplementRepository;

function makeData(
  overrides: Partial<Omit<Supplement, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<Supplement, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    name: overrides.name ?? 'Vitamin D3 2000 IE',
    brand: overrides.brand,
    category: overrides.category ?? 'daily',
    recommendation: overrides.recommendation,
    rationale: overrides.rationale,
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
  repo = new SupplementRepository();
});

describe('SupplementRepository', () => {
  it('round-trips all fields', async () => {
    const s = await repo.create(
      makeData({
        name: 'Magnesium 400mg',
        brand: 'Doppelherz',
        category: 'regular',
        recommendation: 'Abends vor dem Schlafen',
        rationale: 'Muskelkraempfe',
      }),
    );
    const fetched = await repo.getById(s.id);
    expect(fetched?.name).toBe('Magnesium 400mg');
    expect(fetched?.brand).toBe('Doppelherz');
    expect(fetched?.category).toBe('regular');
    expect(fetched?.recommendation).toBe('Abends vor dem Schlafen');
    expect(fetched?.rationale).toBe('Muskelkraempfe');
    lock();
  });

  it('optional fields undefined when absent', async () => {
    const s = await repo.create(makeData());
    const fetched = await repo.getById(s.id);
    expect(fetched?.brand).toBeUndefined();
    expect(fetched?.recommendation).toBeUndefined();
    expect(fetched?.rationale).toBeUndefined();
    lock();
  });

  it('all four category values round-trip', async () => {
    const categories: SupplementCategory[] = ['daily', 'regular', 'paused', 'on-demand'];
    for (const cat of categories) {
      const s = await repo.create(makeData({ category: cat }));
      const fetched = await repo.getById(s.id);
      expect(fetched?.category).toBe(cat);
    }
    lock();
  });

  it('listByCategory filters correctly', async () => {
    await repo.create(makeData({ category: 'daily' }));
    await repo.create(makeData({ category: 'daily' }));
    await repo.create(makeData({ category: 'paused' }));
    await repo.create(makeData({ category: 'on-demand' }));
    await repo.create(makeData({ category: 'regular' }));

    const daily = await repo.listByCategory(profileId, 'daily');
    expect(daily).toHaveLength(2);
    lock();
  });

  it('listByCategory on empty profile returns empty', async () => {
    const result = await repo.listByCategory(profileId, 'daily');
    expect(result).toEqual([]);
    lock();
  });

  it('listByCategory with no matching supplements returns empty', async () => {
    await repo.create(makeData({ category: 'daily' }));
    const result = await repo.listByCategory(profileId, 'paused');
    expect(result).toEqual([]);
    lock();
  });

  it('listActive excludes paused but includes others', async () => {
    await repo.create(makeData({ category: 'daily', name: 'A' }));
    await repo.create(makeData({ category: 'regular', name: 'B' }));
    await repo.create(makeData({ category: 'paused', name: 'C' }));
    await repo.create(makeData({ category: 'on-demand', name: 'D' }));

    const active = await repo.listActive(profileId);
    expect(active).toHaveLength(3);
    expect(active.map((s) => s.name).sort()).toEqual(['A', 'B', 'D']);
    lock();
  });

  it('listActive on all-paused profile returns empty', async () => {
    await repo.create(makeData({ category: 'paused' }));
    await repo.create(makeData({ category: 'paused' }));
    const active = await repo.listActive(profileId);
    expect(active).toEqual([]);
    lock();
  });

  it('inherited base class behaviors', async () => {
    const s = await repo.create(makeData());
    expect(s.id).toMatch(/^[0-9a-f]{8}-/);
    await expect(repo.update(s.id, { id: 'new' } as Partial<Supplement>)).rejects.toThrow(
      'Cannot modify immutable fields',
    );
    lock();
  });

  it('profileId isolation', async () => {
    await repo.create(makeData({ profileId }));
    await repo.create(makeData({ profileId: 'other' }));
    const result = await repo.listByProfile(profileId);
    expect(result).toHaveLength(1);
    lock();
  });
});
