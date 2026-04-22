import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { OpenPointRepository } from './openPointRepository';
import type { OpenPoint } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let repo: OpenPointRepository;

function makeData(
  overrides: Partial<Omit<OpenPoint, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<OpenPoint, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    text: overrides.text ?? 'Vitamin D nachkontrollieren',
    context: overrides.context ?? 'Beim nächsten Arztbesuch',
    resolved: overrides.resolved ?? false,
    priority: overrides.priority,
    timeHorizon: overrides.timeHorizon,
    details: overrides.details,
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
  repo = new OpenPointRepository();
});

describe('OpenPointRepository', () => {
  it('round-trips all fields', async () => {
    const p = await repo.create(
      makeData({
        text: 'TSH bestimmen lassen',
        context: 'Wiederholungs-Blutabnahme',
        resolved: false,
        priority: 'Hoch',
        timeHorizon: 'Innerhalb 3 Monate',
        details: 'Schilddruesenwerte bisher nie bestimmt.',
      }),
    );
    const fetched = await repo.getById(p.id);
    expect(fetched?.text).toBe('TSH bestimmen lassen');
    expect(fetched?.context).toBe('Wiederholungs-Blutabnahme');
    expect(fetched?.resolved).toBe(false);
    expect(fetched?.priority).toBe('Hoch');
    expect(fetched?.timeHorizon).toBe('Innerhalb 3 Monate');
    expect(fetched?.details).toBe('Schilddruesenwerte bisher nie bestimmt.');
    lock();
  });

  it('optional fields undefined when absent', async () => {
    const p = await repo.create(makeData());
    const fetched = await repo.getById(p.id);
    expect(fetched?.priority).toBeUndefined();
    expect(fetched?.timeHorizon).toBeUndefined();
    expect(fetched?.details).toBeUndefined();
    lock();
  });

  it('listUnresolved returns only unresolved', async () => {
    await repo.create(makeData({ resolved: false }));
    await repo.create(makeData({ resolved: false }));
    await repo.create(makeData({ resolved: true }));

    const unresolved = await repo.listUnresolved(profileId);
    expect(unresolved).toHaveLength(2);
    for (const p of unresolved) expect(p.resolved).toBe(false);
    lock();
  });

  it('listUnresolved on all-resolved profile returns empty', async () => {
    await repo.create(makeData({ resolved: true }));
    await repo.create(makeData({ resolved: true }));
    const result = await repo.listUnresolved(profileId);
    expect(result).toEqual([]);
    lock();
  });

  it('listByContext filters correctly', async () => {
    await repo.create(makeData({ context: 'Arztbesuch' }));
    await repo.create(makeData({ context: 'Arztbesuch' }));
    await repo.create(makeData({ context: 'Dermatologe' }));

    const result = await repo.listByContext(profileId, 'Arztbesuch');
    expect(result).toHaveLength(2);
    lock();
  });

  it('listContexts returns deduplicated set', async () => {
    await repo.create(makeData({ context: 'Arztbesuch' }));
    await repo.create(makeData({ context: 'Arztbesuch' }));
    await repo.create(makeData({ context: 'Dermatologe' }));
    await repo.create(makeData({ context: 'Laufend beobachten' }));

    const contexts = await repo.listContexts(profileId);
    expect(contexts.sort()).toEqual(['Arztbesuch', 'Dermatologe', 'Laufend beobachten']);
    lock();
  });

  it('listContexts on empty profile returns empty', async () => {
    const result = await repo.listContexts(profileId);
    expect(result).toEqual([]);
    lock();
  });

  it('markResolved sets resolved=true and refreshes updatedAt', async () => {
    const p = await repo.create(makeData({ resolved: false }));
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    const resolved = await repo.markResolved(p.id);

    expect(resolved.resolved).toBe(true);
    expect(resolved.updatedAt).toBeGreaterThan(p.createdAt);
    lock();
  });

  it('markResolved on already-resolved is idempotent', async () => {
    const p = await repo.create(makeData({ resolved: true }));
    const again = await repo.markResolved(p.id);
    expect(again.resolved).toBe(true);
    lock();
  });

  it('inherited base class behaviors', async () => {
    const p = await repo.create(makeData());
    expect(p.id).toMatch(/^[0-9a-f]{8}-/);
    await expect(repo.update(p.id, { id: 'new' } as Partial<OpenPoint>)).rejects.toThrow(
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
