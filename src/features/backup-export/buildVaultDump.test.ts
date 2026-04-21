import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import { lock, unlockWithKey, deriveKeyFromPassword } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, ObservationRepository } from '../../db/repositories';
import { buildVaultDump } from './buildVaultDump';

const TEST_PASSWORD = 'vault-dump-password';

async function setupUnlocked(): Promise<void> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  // Use the mocked deriveKeyFromPassword + unlockWithKey so the
  // in-memory key matches the key used by setupCompletedOnboarding
  // to encrypt the meta row. Calling `unlock()` directly would
  // bypass the mock because keyStore.unlock() imports
  // deriveKeyFromPassword from the internal ./keyDerivation module.
  const saltBytes = new Uint8Array(meta?.salt ?? new ArrayBuffer(0));
  const key = await deriveKeyFromPassword(TEST_PASSWORD, saltBytes);
  unlockWithKey(key);
}

describe('buildVaultDump', () => {
  beforeEach(async () => {
    await setupUnlocked();
  });

  it('returns locked when the keystore is not unlocked', async () => {
    lock();
    const result = await buildVaultDump();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('locked');
  });

  it('returns no-meta error when the meta row is missing', async () => {
    // Simulate a vault with a key in memory but no meta row.
    const { db } = await import('../../db/schema');
    await db.meta.clear();
    const result = await buildVaultDump();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no-meta');
  });

  it('produces a dump with schemaVersion 2 and all 9 row arrays', async () => {
    const result = await buildVaultDump();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dump.schemaVersion).toBe(2);
    expect(Object.keys(result.dump.rows).sort()).toEqual(
      [
        'profiles',
        'observations',
        'lab_values',
        'lab_reports',
        'supplements',
        'open_points',
        'profile_versions',
        'documents',
        'timeline_entries',
      ].sort(),
    );
  });

  it('includes profile rows in plaintext with identity fields', async () => {
    const profileRepo = new ProfileRepository();
    const p = await profileRepo.create({
      baseData: {
        name: 'Test User',
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

    const result = await buildVaultDump();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dump.rows.profiles.length).toBe(1);
    const row = result.dump.rows.profiles[0];
    if (!row) throw new Error('profile row missing');
    expect(row.id).toBe(p.id);
    expect(row.profileId).toBe(p.id);
  });

  it('includes observations rows across all profiles', async () => {
    const profileRepo = new ProfileRepository();
    const p = await profileRepo.create({
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
      profileId: p.id,
      theme: 'Test',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const result = await buildVaultDump();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dump.rows.observations.length).toBe(1);
    const obs = result.dump.rows.observations[0];
    if (!obs) throw new Error('observation row missing');
    expect(obs.theme).toBe('Test');
  });

  it('preserves meta_settings (verificationToken + settings)', async () => {
    const result = await buildVaultDump();
    if (!result.ok) throw new Error(`buildVaultDump failed: ${JSON.stringify(result.error)}`);
    expect(result.dump.meta_settings.verificationToken).toBe('phylax-verification-v1');
    expect(typeof result.dump.meta_settings.settings?.autoLockMinutes).toBe('number');
  });
});
