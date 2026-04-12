import { IV_LENGTH, ALGORITHM } from './constants';

/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * Generates a fresh 12-byte IV per call via globalThis.crypto.getRandomValues.
 * Returns a single Uint8Array: [IV (12 bytes)][ciphertext + auth tag (16 bytes)].
 *
 * Security: never reuses an IV under the same key. Each call generates a
 * cryptographically random IV. IV reuse under the same key destroys both
 * confidentiality and authenticity of AES-GCM.
 *
 * @param key - AES-GCM CryptoKey (256-bit)
 * @param plaintext - arbitrary bytes to encrypt (may be empty)
 * @returns encrypted payload with prepended IV
 */
export async function encrypt(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertextWithTag = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new Uint8Array(plaintext),
  );

  const result = new Uint8Array(IV_LENGTH + ciphertextWithTag.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertextWithTag), IV_LENGTH);
  return result;
}

/**
 * Decrypt a payload produced by encrypt().
 *
 * Splits the first 12 bytes as IV, passes the remainder to AES-GCM decrypt.
 * Throws on wrong key, tampered ciphertext, tampered IV, or truncated input.
 *
 * Errors from globalThis.crypto.subtle propagate directly. The caller must distinguish
 * failure modes (wrong password vs. data corruption) based on context.
 *
 * @param key - the same AES-GCM CryptoKey used for encryption
 * @param payload - output of encrypt(): [IV][ciphertext + auth tag]
 * @returns original plaintext bytes
 */
export async function decrypt(key: CryptoKey, payload: Uint8Array): Promise<Uint8Array> {
  if (payload.length <= IV_LENGTH) {
    throw new RangeError(
      `Payload too short: expected more than ${IV_LENGTH} bytes, got ${payload.length}`,
    );
  }

  const iv = payload.slice(0, IV_LENGTH);
  const ciphertextWithTag = payload.slice(IV_LENGTH);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertextWithTag,
  );

  return new Uint8Array(plaintext);
}
