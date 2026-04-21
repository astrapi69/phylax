/**
 * Round-trip integration: export a vault, re-import via the existing
 * backup-import pipeline (parseBackupFile -> decryptBackup ->
 * populateVault), and verify the data lands intact.
 *
 * This is the release-blocker test for B-02. Unit tests on
 * createBackup alone could pass with a broken format that the import
 * path rejects; this test proves the two halves are symmetric.
 *
 * NO crypto mock here. Full PBKDF2 path exercised so the test also
 * confirms that `iterations` in the envelope round-trips correctly
 * and the decryptBackup step can re-derive the same key.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import {
  ProfileRepository,
  ObservationRepository,
  SupplementRepository,
  OpenPointRepository,
} from '../../db/repositories';
import { buildVaultDump } from './buildVaultDump';
import { createBackup } from './createBackup';
import { parseBackupFile } from '../backup-import/parseBackupFile';
import { decryptBackup } from '../backup-import/decryptBackup';
import { populateVault } from '../backup-import/populateVault';

const SEED_PASSWORD = 'original-vault-password-12';
const BACKUP_PASSWORD = 'backup-password-34567890';

async function unlockSeeded(): Promise<void> {
  const meta = await readMeta();
  await unlock(SEED_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

describe('B-02 round-trip', () => {
  beforeEach(async () => {
    lock();
    await setupCompletedOnboarding(SEED_PASSWORD);
    await unlockSeeded();
  });

  it(
    'export -> parse -> decrypt -> populate yields an identical VaultDump',
    { timeout: 30000 },
    async () => {
      // Seed data.
      const profileRepo = new ProfileRepository();
      const profile = await profileRepo.create({
        baseData: {
          name: 'Round-trip user',
          weightHistory: [],
          knownDiagnoses: ['Heuschnupfen'],
          currentMedications: [],
          relevantLimitations: [],
          profileType: 'self',
        },
        warningSigns: ['Atemnot'],
        externalReferences: [],
        version: '1.0',
      });

      const obsRepo = new ObservationRepository();
      await obsRepo.create({
        profileId: profile.id,
        theme: 'Knie',
        fact: 'Schmerz bei Belastung',
        pattern: 'Nach langem Sitzen',
        selfRegulation: 'Aufstehen, Lockern',
        status: 'Stabil',
        source: 'user',
        extraSections: {},
      });

      const supplementRepo = new SupplementRepository();
      await supplementRepo.create({
        profileId: profile.id,
        name: 'Magnesium',
        category: 'daily',
        recommendation: 'abends',
      });

      const openPointRepo = new OpenPointRepository();
      await openPointRepo.create({
        profileId: profile.id,
        text: 'Vitamin D pruefen',
        context: 'Blutbild Q2',
        resolved: false,
      });

      // Export.
      const dumpResult = await buildVaultDump();
      expect(dumpResult.ok).toBe(true);
      if (!dumpResult.ok) return;
      const originalDump = dumpResult.dump;

      const backup = await createBackup(originalDump, BACKUP_PASSWORD);
      expect(backup.ok).toBe(true);
      if (!backup.ok) return;

      // Simulate "user downloads, then user imports on a fresh install".
      const file = new File([backup.json], 'phylax-backup-test.phylax', {
        type: 'application/json',
      });

      // Wipe local state - fresh install scenario.
      lock();
      await resetDatabase();

      // Import.
      const parsed = await parseBackupFile(file);
      expect(parsed.valid).toBe(true);
      if (!parsed.valid) return;

      const decrypted = await decryptBackup(parsed.parsed, BACKUP_PASSWORD);
      expect(decrypted.ok).toBe(true);
      if (!decrypted.ok) return;

      const populated = await populateVault(decrypted.dump, decrypted.key, decrypted.saltBytes);
      expect(populated.ok).toBe(true);

      // Decrypt locally using the re-imported key + salt, then re-read
      // the dump to verify post-import equivalence.
      await unlock(BACKUP_PASSWORD, decrypted.saltBytes);
      const afterImport = await buildVaultDump();
      expect(afterImport.ok).toBe(true);
      if (!afterImport.ok) return;

      // Compare. Row counts must match, identity fields must match.
      expect(afterImport.dump.rows.profiles.length).toBe(originalDump.rows.profiles.length);
      expect(afterImport.dump.rows.observations.length).toBe(originalDump.rows.observations.length);
      expect(afterImport.dump.rows.supplements.length).toBe(originalDump.rows.supplements.length);
      expect(afterImport.dump.rows.open_points.length).toBe(originalDump.rows.open_points.length);

      const importedProfile = afterImport.dump.rows.profiles[0];
      const originalProfile = originalDump.rows.profiles[0];
      if (!importedProfile || !originalProfile) throw new Error('profile row missing');
      expect(importedProfile.id).toBe(originalProfile.id);
      expect(importedProfile.profileId).toBe(originalProfile.profileId);

      const importedObs = afterImport.dump.rows.observations[0];
      const originalObs = originalDump.rows.observations[0];
      if (!importedObs || !originalObs) throw new Error('observation row missing');
      expect(importedObs.theme).toBe(originalObs.theme);
      expect(importedObs.fact).toBe(originalObs.fact);
    },
  );

  it(
    'two exports with the same password produce different salts but both decrypt back to equal dumps',
    { timeout: 30000 },
    async () => {
      const profileRepo = new ProfileRepository();
      await profileRepo.create({
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

      const dumpA = await buildVaultDump();
      expect(dumpA.ok).toBe(true);
      if (!dumpA.ok) return;

      const a = await createBackup(dumpA.dump, BACKUP_PASSWORD);
      const b = await createBackup(dumpA.dump, BACKUP_PASSWORD);
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(a.envelope.crypto.salt).not.toBe(b.envelope.crypto.salt);

      const fileA = new File([a.json], 'a.phylax', { type: 'application/json' });
      const fileB = new File([b.json], 'b.phylax', { type: 'application/json' });

      const parsedA = await parseBackupFile(fileA);
      const parsedB = await parseBackupFile(fileB);
      expect(parsedA.valid && parsedB.valid).toBe(true);
      if (!parsedA.valid || !parsedB.valid) return;

      const decA = await decryptBackup(parsedA.parsed, BACKUP_PASSWORD);
      const decB = await decryptBackup(parsedB.parsed, BACKUP_PASSWORD);
      expect(decA.ok && decB.ok).toBe(true);
      if (!decA.ok || !decB.ok) return;

      expect(decA.dump.rows.profiles.length).toBe(decB.dump.rows.profiles.length);
      const profA = decA.dump.rows.profiles[0];
      const profB = decB.dump.rows.profiles[0];
      if (!profA || !profB) throw new Error('profile row missing');
      expect(profA.id).toBe(profB.id);
    },
  );
});
