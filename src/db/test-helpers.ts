import Dexie from 'dexie';
import { db } from './schema';
import { writeMeta, VERIFICATION_TOKEN } from './meta';
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

/**
 * Sets up a completed onboarding state for tests.
 * - Resets the database
 * - Writes meta row with verification token encrypted under the given password
 * - Leaves keyStore in LOCKED state (ready for unlock tests)
 */
export async function setupCompletedOnboarding(password: string): Promise<void> {
  await resetDatabase();

  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);

  // Ensure keyStore is locked before unlocking (handles repeated calls)
  if (getLockState() === 'unlocked') {
    lock();
  }

  unlockWithKey(key);

  const encoded = new TextEncoder().encode(VERIFICATION_TOKEN);
  const encrypted = await encryptWithStoredKey(encoded);
  await writeMeta(new Uint8Array(salt).buffer, new Uint8Array(encrypted).buffer);

  lock();
}
