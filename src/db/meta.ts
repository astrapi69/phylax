import { db } from './schema';
import type { MetaRow } from './types';

/** Fixed ID for the singleton meta row. */
export const META_ID = 'singleton';

/**
 * Verification token encrypted and stored in meta.payload during onboarding.
 * Used by the unlock flow (F-13) to verify the master password is correct.
 *
 * WARNING: changing this string would break all existing installations.
 * Existing meta rows contain this token encrypted with the user's key.
 * The 'v1' suffix allows evolving the verification mechanism in the future
 * by checking for 'v2' etc. without breaking reads of older meta rows.
 */
export const VERIFICATION_TOKEN = 'phylax-verification-v1';

/** Current schema version for new installations. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Write or overwrite the meta singleton row.
 *
 * @param salt - PBKDF2 salt (plaintext, needed for key derivation)
 * @param payload - encrypted verification token (from encryptWithStoredKey)
 */
export async function writeMeta(salt: ArrayBuffer, payload: ArrayBuffer): Promise<void> {
  const row: MetaRow = {
    id: META_ID,
    salt,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    payload,
  };
  await db.meta.put(row);
}

/**
 * Read the meta singleton row. Returns null if no meta row exists
 * (first-time user, onboarding not yet completed).
 */
export async function readMeta(): Promise<MetaRow | null> {
  const row = await db.meta.get(META_ID);
  return row ?? null;
}

/**
 * Check whether the meta row exists. Used to decide whether to show
 * the onboarding flow or the unlock flow.
 */
export async function metaExists(): Promise<boolean> {
  const count = await db.meta.where('id').equals(META_ID).count();
  return count > 0;
}
