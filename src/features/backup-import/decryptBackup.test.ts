import { describe, it, expect, vi } from 'vitest';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import { encrypt, generateSalt, deriveKeyFromPassword } from '../../crypto';
import { PBKDF2_ITERATIONS } from '../../crypto/constants';
import { decryptBackup, SUPPORTED_INNER_SCHEMA_VERSION } from './decryptBackup';
import type { ParsedPhylaxFile } from './parseBackupFile';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function makeBackup(
  password: string,
  inner: unknown = {
    schemaVersion: SUPPORTED_INNER_SCHEMA_VERSION,
    rows: {},
    meta_settings: {},
  },
): Promise<ParsedPhylaxFile> {
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(inner));
  const ciphertext = await encrypt(key, plaintext);
  return {
    version: 1,
    type: 'phylax-backup',
    created: '2026-04-20T00:00:00Z',
    source: { app: 'phylax', appVersion: '0.0.0' },
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

describe('decryptBackup', () => {
  it('round-trips a valid backup', async () => {
    const inner = {
      schemaVersion: 2,
      rows: {
        profiles: [{ id: 'p1', profileId: 'p1', createdAt: 1, updatedAt: 2, baseData: {} }],
      },
      meta_settings: { settings: { autoLockMinutes: 10 } },
    };
    const parsed = await makeBackup('correct-horse', inner);
    const result = await decryptBackup(parsed, 'correct-horse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dump.rows.profiles.length).toBe(1);
      expect(result.dump.rows.profiles[0]?.id).toBe('p1');
      expect(result.dump.meta_settings.settings?.autoLockMinutes).toBe(10);
      expect(result.saltBytes.length).toBe(32);
    }
  });

  it('returns wrong-password on bad password', async () => {
    const parsed = await makeBackup('correct-horse');
    const result = await decryptBackup(parsed, 'wrong-password');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('wrong-password');
  });

  it('returns wrong-password on tampered ciphertext', async () => {
    const parsed = await makeBackup('correct-horse');
    const bytes = Array.from(atob(parsed.data), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    const tampered: ParsedPhylaxFile = {
      ...parsed,
      data: bytesToBase64(new Uint8Array(bytes)),
    };
    const result = await decryptBackup(tampered, 'correct-horse');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('wrong-password');
  });

  it('returns corrupted when inner payload is not JSON', async () => {
    // Construct a backup whose plaintext is invalid UTF-8 or non-JSON.
    // Use makeBackup with a plaintext string that decrypts to non-JSON.
    const password = 'abcxyzabcxyz';
    const salt = generateSalt();
    const key = await deriveKeyFromPassword(password, salt);
    const plaintextBytes = new TextEncoder().encode('not-json-at-all');
    const encrypted = await encrypt(key, plaintextBytes);
    const parsed: ParsedPhylaxFile = {
      version: 1,
      type: 'phylax-backup',
      created: '2026-04-20T00:00:00Z',
      source: { app: 'phylax', appVersion: '0.0.0' },
      crypto: {
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
      },
      data: bytesToBase64(new Uint8Array(encrypted)),
    };
    const result = await decryptBackup(parsed, password);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('corrupted');
  });

  it('rejects unsupported inner schemaVersion', async () => {
    const parsed = await makeBackup('correct-horse', {
      schemaVersion: 99,
      rows: {},
      meta_settings: {},
    });
    const result = await decryptBackup(parsed, 'correct-horse');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('unsupported-inner-schema');
  });

  it('rejects inner rows of wrong shape', async () => {
    const parsed = await makeBackup('correct-horse', {
      schemaVersion: 2,
      rows: { profiles: [{ id: 'no-profileId' }] },
      meta_settings: {},
    });
    const result = await decryptBackup(parsed, 'correct-horse');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('corrupted');
  });
});
