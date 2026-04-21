/**
 * Test-only helper that builds a replacement `../../crypto` module
 * swapping the slow PBKDF2 derivation for a deterministic AES-GCM
 * key imported from 32 bytes derived from the password text.
 *
 * Purpose: PBKDF2 at 1.2M iterations (ADR-0001) runs ~500ms locally,
 * ~1500ms on a 4-vCPU CI runner. Non-crypto tests that use
 * `deriveKeyFromPassword` only need a functional AES key for
 * round-trip encrypt/decrypt assertions. Real PBKDF2 adds latency
 * without adding test value.
 *
 * Semantics preserved:
 *   - Same password -> same key (deterministic; round-trip tests pass)
 *   - Different password -> different key (AES-GCM auth tag mismatch
 *     on decrypt; wrong-password / tampered-ciphertext tests still
 *     fail at the decrypt step, via real AES-GCM, not PBKDF2)
 *   - `encrypt` / `decrypt` / `generateSalt` / `unlockWithKey` etc.
 *     remain real. Only the derivation step is swapped.
 *
 * Salt is ignored by the mock. Acceptable: the affected tests do
 * not assert on salt-to-key correlation; they assert on downstream
 * encrypted-payload behavior.
 *
 * Usage:
 *   vi.mock('../../crypto', async (importOriginal) => {
 *     const { buildCryptoMockModule } = await import(
 *       '../../crypto/testHelpers/mockDeriveKey'
 *     );
 *     return buildCryptoMockModule(importOriginal);
 *   });
 *
 * The dynamic import inside the factory is required because `vi.mock`
 * is hoisted above all static imports - a statically imported helper
 * is not yet initialized when the factory runs.
 *
 * Do NOT use in `src/crypto/*.test.ts` files - those exercise real
 * crypto and are the reason this mock exists elsewhere.
 */

type CryptoModule = typeof import('../index');

export async function buildCryptoMockModule(
  importOriginal: <T>() => Promise<T>,
): Promise<CryptoModule> {
  const actual = await importOriginal<CryptoModule>();
  const cache = new Map<string, CryptoKey>();

  async function mockDerive(
    password: string,
    _salt: Uint8Array,
    _iterations?: number,
  ): Promise<CryptoKey> {
    const cached = cache.get(password);
    if (cached) return cached;

    const pw = new TextEncoder().encode(password);
    const raw = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      raw[i] = pw[i % pw.length] ?? 0;
    }
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    cache.set(password, key);
    return key;
  }

  return { ...actual, deriveKeyFromPassword: mockDerive };
}
