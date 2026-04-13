// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveKeyFromPassword, generateSalt } from './keyDerivation';
import { encrypt, decrypt } from './aesGcm';
import { SALT_LENGTH } from './constants';

describe('PBKDF2 key derivation', () => {
  describe('key properties', () => {
    it('derives a non-extractable AES-GCM 256-bit key', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassword('test-password', salt);
      const algo = key.algorithm as AesKeyAlgorithm;

      expect(algo.name).toBe('AES-GCM');
      expect(algo.length).toBe(256);
      expect(key.extractable).toBe(false);
      expect(key.usages).toEqual(['encrypt', 'decrypt']);
    });
  });

  describe('determinism', () => {
    it('same password and salt produce functionally identical keys', async () => {
      const password = 'my-master-password';
      const salt = generateSalt();
      const keyA = await deriveKeyFromPassword(password, salt);
      const keyB = await deriveKeyFromPassword(password, salt);

      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const ciphertext = await encrypt(keyA, plaintext);
      const decrypted = await decrypt(keyB, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });
  });

  describe('key isolation', () => {
    it('different salts produce incompatible keys', async () => {
      const password = 'same-password';
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const key1 = await deriveKeyFromPassword(password, salt1);
      const key2 = await deriveKeyFromPassword(password, salt2);

      const ciphertext = await encrypt(key1, new Uint8Array([10, 20, 30]));

      await expect(decrypt(key2, ciphertext)).rejects.toThrow();
    });

    it('different passwords produce incompatible keys', async () => {
      const salt = generateSalt();
      const keyA = await deriveKeyFromPassword('password-alpha', salt);
      const keyB = await deriveKeyFromPassword('password-beta', salt);

      const ciphertext = await encrypt(keyA, new Uint8Array([10, 20, 30]));

      await expect(decrypt(keyB, ciphertext)).rejects.toThrow();
    });
  });

  describe('salt generation', () => {
    it('produces exactly SALT_LENGTH bytes', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(SALT_LENGTH);
    });

    it('produces unique salts across 100 calls', () => {
      const salts = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const salt = generateSalt();
        salts.add(Array.from(salt).join(','));
      }
      expect(salts.size).toBe(100);
    });
  });

  describe('salt validation', () => {
    it('rejects salt shorter than SALT_LENGTH', async () => {
      await expect(deriveKeyFromPassword('password', new Uint8Array(16))).rejects.toThrow(
        `Salt must be exactly ${SALT_LENGTH} bytes, got 16`,
      );
    });

    it('rejects empty salt', async () => {
      await expect(deriveKeyFromPassword('password', new Uint8Array(0))).rejects.toThrow(
        `Salt must be exactly ${SALT_LENGTH} bytes, got 0`,
      );
    });

    it('rejects salt longer than SALT_LENGTH', async () => {
      await expect(deriveKeyFromPassword('password', new Uint8Array(64))).rejects.toThrow(
        `Salt must be exactly ${SALT_LENGTH} bytes, got 64`,
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty password', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassword('', salt);

      const plaintext = new Uint8Array([42]);
      const ciphertext = await encrypt(key, plaintext);
      const decrypted = await decrypt(key, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it('handles non-ASCII password with umlauts and emoji', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassword('Pässwörd 🔐', salt);

      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const ciphertext = await encrypt(key, plaintext);
      const decrypted = await decrypt(key, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });
  });

  describe('performance', () => {
    it('completes one derivation in under 5 seconds', async () => {
      const salt = generateSalt();
      const start = performance.now();
      await deriveKeyFromPassword('performance-test', salt);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5000);
    });
  });
});
