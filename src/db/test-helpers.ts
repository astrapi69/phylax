import Dexie from 'dexie';
import { db } from './schema';
import { writeMeta, VERIFICATION_TOKEN } from './meta';
import { encodeMetaPayload, DEFAULT_SETTINGS } from './settings';
import {
  generateSalt,
  deriveKeyFromPassword,
  unlockWithKey,
  encryptWithStoredKey,
  lock,
  getLockState,
} from '../crypto';

/**
 * Reset the Phylax database for test isolation.
 * Deletes the database and re-opens a fresh instance.
 * Only for use in test files.
 */
export async function resetDatabase(): Promise<void> {
  db.close();
  await Dexie.delete('phylax');
  await db.open();
}

export interface SetupOnboardingOptions {
  /** If true, creates a default 'self' profile after onboarding. Default: false. */
  createDefaultProfile?: boolean;
}

/**
 * Sets up a completed onboarding state for tests.
 * - Resets the database
 * - Writes meta row with verification token encrypted under the given password
 * - Optionally creates a default profile (for tests that need a ready-to-use state)
 * - Leaves keyStore in LOCKED state (ready for unlock tests)
 */
export async function setupCompletedOnboarding(
  password: string,
  options?: SetupOnboardingOptions,
): Promise<void> {
  await resetDatabase();

  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);

  if (getLockState() === 'unlocked') {
    lock();
  }

  unlockWithKey(key);

  const payloadBytes = encodeMetaPayload({
    verificationToken: VERIFICATION_TOKEN,
    settings: DEFAULT_SETTINGS,
  });
  const encrypted = await encryptWithStoredKey(payloadBytes);
  await writeMeta(new Uint8Array(salt).buffer, new Uint8Array(encrypted).buffer);

  if (options?.createDefaultProfile) {
    const { ProfileRepository } = await import('./repositories/profileRepository');
    const repo = new ProfileRepository();
    await repo.create({
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
  }

  lock();
}
