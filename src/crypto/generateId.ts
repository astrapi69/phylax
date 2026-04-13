/**
 * Generate a cryptographically random UUID v4.
 *
 * Lives in src/crypto/ because it uses the crypto global (randomUUID).
 * The ESLint no-restricted-globals rule restricts all crypto usage to
 * this module. randomUUID is not key material, but it is on the crypto
 * global, so it lives here for rule consistency.
 *
 * @returns UUID v4 string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateId(): string {
  return globalThis.crypto.randomUUID();
}
