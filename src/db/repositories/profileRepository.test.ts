import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import type { Profile } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let repo: ProfileRepository;

function makeProfileData(): Omit<Profile, 'id' | 'profileId' | 'createdAt' | 'updatedAt'> {
  return {
    baseData: {
      birthDate: '1982-05-15',
      age: 43,
      heightCm: 178,
      weightKg: 96.5,
      targetWeightKg: 85,
      weightHistory: [
        { date: '2025-01-01', weightKg: 98 },
        { date: '2025-06-15', weightKg: 96.5 },
      ],
      primaryDoctor: {
        name: 'Dr. Mueller',
        address: 'Hauptstrasse 1',
        specialty: 'Allgemeinmedizin',
      },
      knownDiagnoses: ['Impingement links', 'Veneninsuffizienz'],
      currentMedications: ['Ibuprofen bei Bedarf'],
      relevantLimitations: ['Gelenkprobleme beidseitig'],
      profileType: 'self',
      contextNotes: '## Lifestyle\n\nAktiv, regelmaessiges Krafttraining.',
    },
    warningSigns: ['Brustschmerzen bei Belastung', 'Ploetzlicher Schwindel'],
    externalReferences: ['Lebende Gesundheit Serie: https://example.com'],
    version: '1.3.1',
    lastUpdateReason: 'Blutbild März 2026 ergaenzt',
  };
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  // Unlock for repository operations
  const { readMeta } = await import('../meta');
  const { unlock } = await import('../../crypto');
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
  repo = new ProfileRepository();
});

describe('ProfileRepository', () => {
  it('round-trips all Profile fields', async () => {
    const data = makeProfileData();
    const created = await repo.create(data);
    const fetched = await repo.getById(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.baseData.birthDate).toBe('1982-05-15');
    expect(fetched?.baseData.age).toBe(43);
    expect(fetched?.baseData.heightCm).toBe(178);
    expect(fetched?.baseData.weightKg).toBe(96.5);
    expect(fetched?.baseData.targetWeightKg).toBe(85);
    expect(fetched?.baseData.primaryDoctor).toEqual(data.baseData.primaryDoctor);
    expect(fetched?.baseData.knownDiagnoses).toEqual(data.baseData.knownDiagnoses);
    expect(fetched?.baseData.currentMedications).toEqual(data.baseData.currentMedications);
    expect(fetched?.baseData.relevantLimitations).toEqual(data.baseData.relevantLimitations);
    expect(fetched?.warningSigns).toEqual(data.warningSigns);
    expect(fetched?.externalReferences).toEqual(data.externalReferences);
    expect(fetched?.version).toBe('1.3.1');
    expect(fetched?.lastUpdateReason).toBe('Blutbild März 2026 ergaenzt');

    lock();
  });

  it('preserves BaseData nested structure (WeightEntry[], DoctorInfo, optionals)', async () => {
    const data = makeProfileData();
    const created = await repo.create(data);
    const fetched = await repo.getById(created.id);

    expect(fetched?.baseData.weightHistory).toHaveLength(2);
    expect(fetched?.baseData.weightHistory[0]).toEqual({ date: '2025-01-01', weightKg: 98 });
    expect(fetched?.baseData.weightHistory[1]).toEqual({ date: '2025-06-15', weightKg: 96.5 });
    expect(fetched?.baseData.primaryDoctor?.name).toBe('Dr. Mueller');
    expect(fetched?.baseData.primaryDoctor?.specialty).toBe('Allgemeinmedizin');

    lock();
  });

  it('profileId equals id (self-reference)', async () => {
    const created = await repo.create(makeProfileData());
    expect(created.profileId).toBe(created.id);

    const fetched = await repo.getById(created.id);
    expect(fetched?.profileId).toBe(fetched?.id);

    lock();
  });

  it('getCurrentProfile returns null when empty', async () => {
    const result = await repo.getCurrentProfile();
    expect(result).toBeNull();
    lock();
  });

  it('getCurrentProfile returns the profile', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const created = await repo.create(makeProfileData());
    const current = await repo.getCurrentProfile();

    expect(current).not.toBeNull();
    expect(current?.id).toBe(created.id);
    expect(current?.version).toBe('1.3.1');
    // Negative assertion: the multi-profile warning branch must NOT fire
    // for a single profile. Guards the `rows.length > 1` condition
    // against mutations that always enter the branch.
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    lock();
  });

  it('getCurrentProfile warns on multiple profiles', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await repo.create(makeProfileData());
    // Create a second profile (unusual in MVP, but tests the guard)
    await repo.create({ ...makeProfileData(), version: '2.0.0' });

    const current = await repo.getCurrentProfile();
    expect(current).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Found 2 profiles'));

    warnSpy.mockRestore();
    lock();
  });

  it('update preserves profileId self-reference', async () => {
    const created = await repo.create(makeProfileData());
    const updated = await repo.update(created.id, { version: '1.4.0' });

    expect(updated.profileId).toBe(created.id);
    expect(updated.version).toBe('1.4.0');

    lock();
  });

  it('delete removes the profile', async () => {
    const created = await repo.create(makeProfileData());
    await repo.delete(created.id);
    const result = await repo.getCurrentProfile();
    expect(result).toBeNull();
    lock();
  });

  it('contextNotes with Markdown round-trips intact', async () => {
    const data = makeProfileData();
    const created = await repo.create(data);
    const fetched = await repo.getById(created.id);

    expect(fetched?.baseData.contextNotes).toBe(
      '## Lifestyle\n\nAktiv, regelmaessiges Krafttraining.',
    );
    lock();
  });

  it('empty arrays preserved (not undefined)', async () => {
    const data = makeProfileData();
    data.baseData.weightHistory = [];
    data.warningSigns = [];
    data.externalReferences = [];

    const created = await repo.create(data);
    const fetched = await repo.getById(created.id);

    expect(fetched?.baseData.weightHistory).toEqual([]);
    expect(fetched?.warningSigns).toEqual([]);
    expect(fetched?.externalReferences).toEqual([]);

    lock();
  });

  it('profileType preserved for both self and proxy', async () => {
    const selfData = makeProfileData();
    const selfProfile = await repo.create(selfData);
    expect(selfProfile.baseData.profileType).toBe('self');

    const proxyData = makeProfileData();
    proxyData.baseData.profileType = 'proxy';
    proxyData.baseData.managedBy = 'Sohn';
    const proxyProfile = await repo.create(proxyData);
    expect(proxyProfile.baseData.profileType).toBe('proxy');

    const fetchedProxy = await repo.getById(proxyProfile.id);
    expect(fetchedProxy?.baseData.profileType).toBe('proxy');

    lock();
  });

  it('list returns empty array when no profiles exist', async () => {
    const profiles = await repo.list();
    expect(profiles).toEqual([]);
    lock();
  });

  it('list returns all profiles with full decrypted content', async () => {
    await repo.create(makeProfileData());
    const proxyData = makeProfileData();
    proxyData.baseData.profileType = 'proxy';
    proxyData.baseData.managedBy = 'Anna';
    await repo.create(proxyData);

    const profiles = await repo.list();
    expect(profiles).toHaveLength(2);
    const types = profiles.map((p) => p.baseData.profileType).sort();
    expect(types).toEqual(['proxy', 'self']);
    lock();
  });

  it('managedBy preserved for proxy profiles', async () => {
    const data = makeProfileData();
    data.baseData.profileType = 'proxy';
    data.baseData.managedBy = 'Asterios Raptis (Sohn)';

    const created = await repo.create(data);
    const fetched = await repo.getById(created.id);

    expect(fetched?.baseData.managedBy).toBe('Asterios Raptis (Sohn)');

    lock();
  });
});
