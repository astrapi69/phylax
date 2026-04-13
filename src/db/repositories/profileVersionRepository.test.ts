import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { ProfileVersionRepository } from './profileVersionRepository';
import type { ProfileVersion } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let repo: ProfileVersionRepository;

function makeData(
  overrides: Partial<Omit<ProfileVersion, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<ProfileVersion, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    version: overrides.version ?? '1.0.0',
    changeDescription: overrides.changeDescription ?? 'Initial version',
    changeDate: overrides.changeDate ?? '2026-01-01',
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
  repo = new ProfileVersionRepository();
});

describe('ProfileVersionRepository', () => {
  it('round-trips all fields', async () => {
    const v = await repo.create(
      makeData({
        version: '1.3.1',
        changeDescription: 'Blutbild Maerz 2026 ergaenzt',
        changeDate: '2026-03-20',
      }),
    );
    const fetched = await repo.getById(v.id);
    expect(fetched?.version).toBe('1.3.1');
    expect(fetched?.changeDescription).toBe('Blutbild Maerz 2026 ergaenzt');
    expect(fetched?.changeDate).toBe('2026-03-20');
    lock();
  });

  it('listByProfileNewestFirst sorts correctly', async () => {
    await repo.create(makeData({ version: '1.0.0', changeDate: '2024-06-01' }));
    await repo.create(makeData({ version: '1.3.0', changeDate: '2026-03-15' }));
    await repo.create(makeData({ version: '1.2.0', changeDate: '2025-12-01' }));

    const sorted = await repo.listByProfileNewestFirst(profileId);
    expect(sorted).toHaveLength(3);
    expect(sorted[0]?.version).toBe('1.3.0');
    expect(sorted[1]?.version).toBe('1.2.0');
    expect(sorted[2]?.version).toBe('1.0.0');
    lock();
  });

  it('listByProfileNewestFirst on empty profile returns empty', async () => {
    const result = await repo.listByProfileNewestFirst(profileId);
    expect(result).toEqual([]);
    lock();
  });

  it('getLatest returns newest by changeDate', async () => {
    await repo.create(makeData({ version: '1.0.0', changeDate: '2024-06-01' }));
    await repo.create(makeData({ version: '1.3.1', changeDate: '2026-04-13' }));
    await repo.create(makeData({ version: '1.2.0', changeDate: '2025-12-01' }));

    const latest = await repo.getLatest(profileId);
    expect(latest?.version).toBe('1.3.1');
    expect(latest?.changeDate).toBe('2026-04-13');
    lock();
  });

  it('getLatest on empty profile returns null', async () => {
    const result = await repo.getLatest(profileId);
    expect(result).toBeNull();
    lock();
  });

  it('getLatest on single-version profile returns that version', async () => {
    await repo.create(makeData({ version: '1.0.0' }));
    const latest = await repo.getLatest(profileId);
    expect(latest?.version).toBe('1.0.0');
    lock();
  });

  it('inherited base class behaviors', async () => {
    const v = await repo.create(makeData());
    expect(v.id).toMatch(/^[0-9a-f]{8}-/);
    await expect(repo.update(v.id, { id: 'new' } as Partial<ProfileVersion>)).rejects.toThrow(
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
