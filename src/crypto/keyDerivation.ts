import {
  ALGORITHM,
  DERIVED_KEY_LENGTH,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
} from './constants';

/**
 * Derive a 256-bit AES-GCM CryptoKey from a master password and salt.
 *
 * Uses PBKDF2 with SHA-256. Default iteration count is the current
 * app constant (`PBKDF2_ITERATIONS`). The `iterations` parameter
 * exists to support decrypting `.phylax` backup files created with a
 * different iteration count (see `docs/backup-format.md`) without
 * breaking the app-wide constant for new vaults. Callers outside the
 * backup-import flow should omit `iterations` and accept the default.
 *
 * The resulting key is non-extractable and usable only for
 * encrypt/decrypt.
 *
 * Security: both the intermediate PBKDF2 base key and the final AES
 * key are created with extractable=false. There is no legitimate use
 * case for exporting key material once derived.
 *
 * @param password - master password (UTF-8 string, may be empty)
 * @param salt - random salt from generateSalt(), must be exactly SALT_LENGTH (32) bytes
 * @param iterations - PBKDF2 iteration count; defaults to PBKDF2_ITERATIONS
 * @returns non-extractable AES-GCM CryptoKey (256-bit)
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (salt.length !== SALT_LENGTH) {
    throw new Error(`Salt must be exactly ${SALT_LENGTH} bytes, got ${salt.length}`);
  }

  const passwordBytes = new TextEncoder().encode(password);

  const baseKey = await globalThis.crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, [
    'deriveKey',
  ]);

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: ALGORITHM, length: DERIVED_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Generate a cryptographically random salt for PBKDF2.
 *
 * Used once per user on initial master password setup. The salt is
 * stored (unencrypted) alongside the ciphertext in IndexedDB.
 *
 * @returns SALT_LENGTH (32) random bytes
 */
export function generateSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}
