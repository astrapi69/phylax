import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { TimelineEntryRepository } from './timelineEntryRepository';
import type { TimelineEntry } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let repo: TimelineEntryRepository;

function makeData(
  overrides: Partial<Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    period: overrides.period ?? 'Dezember 2024',
    title: overrides.title ?? 'Brustkorbbeschwerden',
    content: overrides.content ?? '- Schmerz beim Atmen\n- Kein Befund',
    source: overrides.source ?? 'user',
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
  repo = new TimelineEntryRepository();
});

describe('TimelineEntryRepository', () => {
  it('round-trips all fields', async () => {
    const e = await repo.create(
      makeData({
        period: 'Maerz 2026',
        title: 'Gewichtszunahme und Abnehmplan',
        content: '- Gewicht: 96.5kg\n- Ziel: 85kg\n- Plan erstellt',
        source: 'ai',
      }),
    );
    const fetched = await repo.getById(e.id);
    expect(fetched?.period).toBe('Maerz 2026');
    expect(fetched?.title).toBe('Gewichtszunahme und Abnehmplan');
    expect(fetched?.content).toBe('- Gewicht: 96.5kg\n- Ziel: 85kg\n- Plan erstellt');
    expect(fetched?.source).toBe('ai');
    lock();
  });

  it('Markdown content preserved', async () => {
    const markdown = '## Zusammenfassung\n\n- **Fakt 1**: Text\n- *Fakt 2*: Mehr Text\n\n> Zitat';
    const e = await repo.create(makeData({ content: markdown }));
    const fetched = await repo.getById(e.id);
    expect(fetched?.content).toBe(markdown);
    lock();
  });

  it('all three source values round-trip', async () => {
    for (const source of ['user', 'ai', 'medical'] as const) {
      const e = await repo.create(makeData({ source }));
      const fetched = await repo.getById(e.id);
      expect(fetched?.source).toBe(source);
    }
    lock();
  });

  it('listChronological sorts by createdAt ascending', async () => {
    const e1 = await repo.create(makeData({ title: 'First' }));
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    const e2 = await repo.create(makeData({ title: 'Second' }));
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    const e3 = await repo.create(makeData({ title: 'Third' }));

    const sorted = await repo.listChronological(profileId);
    expect(sorted).toHaveLength(3);
    expect(sorted[0]?.id).toBe(e1.id);
    expect(sorted[1]?.id).toBe(e2.id);
    expect(sorted[2]?.id).toBe(e3.id);
    lock();
  });

  it('listChronological on empty profile returns empty', async () => {
    const result = await repo.listChronological(profileId);
    expect(result).toEqual([]);
    lock();
  });

  it('period with German month names preserved verbatim', async () => {
    const periods = ['Januar 2024', 'Februar 2025', 'Maerz 2026', 'Oktober-November 2025'];
    for (const period of periods) {
      const e = await repo.create(makeData({ period }));
      const fetched = await repo.getById(e.id);
      expect(fetched?.period).toBe(period);
    }
    lock();
  });

  it('inherited base class behaviors', async () => {
    const e = await repo.create(makeData());
    expect(e.id).toMatch(/^[0-9a-f]{8}-/);
    await expect(repo.update(e.id, { id: 'new' } as Partial<TimelineEntry>)).rejects.toThrow(
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
