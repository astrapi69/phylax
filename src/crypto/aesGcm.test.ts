// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './aesGcm';
import { IV_LENGTH, AUTH_TAG_LENGTH, ALGORITHM } from './constants';

function flipBit(arr: Uint8Array, index: number): void {
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  view.setUint8(index, view.getUint8(index) ^ 0x01);
}

async function generateTestKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

describe('AES-256-GCM encrypt/decrypt', () => {
  describe('key properties', () => {
    it('generates a 256-bit AES-GCM key', async () => {
      const key = await generateTestKey();
      const algo = key.algorithm as AesKeyAlgorithm;
      expect(algo.name).toBe('AES-GCM');
      expect(algo.length).toBe(256);
    });
  });

  describe('round-trip', () => {
    it('encrypts and decrypts empty plaintext', async () => {
      const key = await generateTestKey();
      const plaintext = new Uint8Array(0);
      const ciphertext = await encrypt(key, plaintext);
      const decrypted = await decrypt(key, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it('encrypts and decrypts 1 byte', async () => {
      const key = await generateTestKey();
      const plaintext = new Uint8Array([42]);
      const ciphertext = await encrypt(key, plaintext);
      const decrypted = await decrypt(key, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it('encrypts and decrypts 100 bytes', async () => {
      const key = await generateTestKey();
      const plaintext = globalThis.crypto.getRandomValues(new Uint8Array(100));
      const ciphertext = await encrypt(key, plaintext);
      const decrypted = await decrypt(key, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it('encrypts and decrypts 100 KB', async () => {
      const key = await generateTestKey();
      // crypto.getRandomValues has a 65536-byte limit per call, so fill in chunks
      const plaintext = new Uint8Array(102400);
      for (let offset = 0; offset < plaintext.length; offset += 65536) {
        const chunk = plaintext.subarray(offset, Math.min(offset + 65536, plaintext.length));
        globalThis.crypto.getRandomValues(chunk);
      }
      const ciphertext = await encrypt(key, plaintext);
      const decrypted = await decrypt(key, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });
  });

  describe('output format', () => {
    it('output length is IV + plaintext + auth tag', async () => {
      const key = await generateTestKey();
      const plaintext = globalThis.crypto.getRandomValues(new Uint8Array(50));
      const ciphertext = await encrypt(key, plaintext);
      expect(ciphertext.length).toBe(IV_LENGTH + plaintext.length + AUTH_TAG_LENGTH);
    });
  });

  describe('IV uniqueness', () => {
    it('generates unique IVs across 100 encryptions', async () => {
      const key = await generateTestKey();
      const plaintext = new Uint8Array([1, 2, 3]);
      const ivs = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const result = await encrypt(key, plaintext);
        const iv = Array.from(result.slice(0, IV_LENGTH)).join(',');
        ivs.add(iv);
      }

      expect(ivs.size).toBe(100);
    });
  });

  describe('authentication and integrity', () => {
    it('throws on wrong key', async () => {
      const keyA = await generateTestKey();
      const keyB = await generateTestKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const ciphertext = await encrypt(keyA, plaintext);

      await expect(decrypt(keyB, ciphertext)).rejects.toThrow();
    });

    it('throws on tampered ciphertext body', async () => {
      const key = await generateTestKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const ciphertext = await encrypt(key, plaintext);

      // Flip one bit in the ciphertext body (first byte after IV)
      const tampered = new Uint8Array(ciphertext);
      flipBit(tampered, IV_LENGTH);

      await expect(decrypt(key, tampered)).rejects.toThrow();
    });

    it('throws on tampered auth tag', async () => {
      const key = await generateTestKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const ciphertext = await encrypt(key, plaintext);

      // Flip one bit in the last byte (auth tag region)
      const tampered = new Uint8Array(ciphertext);
      flipBit(tampered, tampered.length - 1);

      await expect(decrypt(key, tampered)).rejects.toThrow();
    });

    it('throws on tampered IV', async () => {
      const key = await generateTestKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const ciphertext = await encrypt(key, plaintext);

      // Flip one bit in the first byte (IV region)
      const tampered = new Uint8Array(ciphertext);
      flipBit(tampered, 0);

      await expect(decrypt(key, tampered)).rejects.toThrow();
    });

    it('throws on truncated ciphertext', async () => {
      const key = await generateTestKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const ciphertext = await encrypt(key, plaintext);

      // Remove last byte
      const truncated = ciphertext.slice(0, ciphertext.length - 1);

      await expect(decrypt(key, truncated)).rejects.toThrow();
    });

    it('throws on payload shorter than IV length', async () => {
      const key = await generateTestKey();
      const tooShort = new Uint8Array(IV_LENGTH);

      await expect(decrypt(key, tooShort)).rejects.toThrow(RangeError);
      await expect(decrypt(key, tooShort)).rejects.toThrow(/Payload too short/);
      await expect(decrypt(key, tooShort)).rejects.toThrow(new RegExp(`${IV_LENGTH}`));
    });

    it('throws on empty payload', async () => {
      const key = await generateTestKey();
      const empty = new Uint8Array(0);

      await expect(decrypt(key, empty)).rejects.toThrow(RangeError);
      await expect(decrypt(key, empty)).rejects.toThrow(/Payload too short/);
    });
  });
});
