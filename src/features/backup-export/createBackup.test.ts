import { describe, it, expect, vi } from 'vitest';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import { createBackup } from './createBackup';
import { PBKDF2_ITERATIONS } from '../../crypto/constants';
import type { VaultDump } from '../backup-import/decryptBackup';

function emptyDump(): VaultDump {
  return {
    schemaVersion: 2,
    rows: {
      profiles: [],
      observations: [],
      lab_values: [],
      lab_reports: [],
      supplements: [],
      open_points: [],
      profile_versions: [],
      documents: [],
      timeline_entries: [],
    },
    meta_settings: {},
  };
}

describe('createBackup', () => {
  it('produces an envelope with the spec-mandated header fields', async () => {
    const result = await createBackup(emptyDump(), 'backup-password-123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.envelope.version).toBe(1);
    expect(result.envelope.type).toBe('phylax-backup');
    expect(result.envelope.source.app).toBe('phylax');
    expect(typeof result.envelope.source.appVersion).toBe('string');
    expect(result.envelope.crypto.algorithm).toBe('AES-256-GCM');
    expect(result.envelope.crypto.kdf).toBe('PBKDF2-SHA256');
    expect(result.envelope.crypto.iterations).toBe(PBKDF2_ITERATIONS);
  });

  it('writes the injected timestamp to `created`', async () => {
    const fixed = new Date('2026-04-21T12:00:00Z');
    const result = await createBackup(emptyDump(), 'backup-password-123', fixed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.created).toBe('2026-04-21T12:00:00.000Z');
  });

  it('generates a fresh salt per export (two exports -> different salts)', async () => {
    const a = await createBackup(emptyDump(), 'same-password-12');
    const b = await createBackup(emptyDump(), 'same-password-12');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.envelope.crypto.salt).not.toBe(b.envelope.crypto.salt);
  });

  it('base64-encodes a salt whose decoded length is 32 bytes', async () => {
    const result = await createBackup(emptyDump(), 'backup-password-123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(atob(result.envelope.crypto.salt).length).toBe(32);
  });

  it('json field round-trips through JSON.parse', async () => {
    const result = await createBackup(emptyDump(), 'backup-password-123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.json);
    expect(parsed.type).toBe('phylax-backup');
    expect(parsed.crypto.salt).toBe(result.envelope.crypto.salt);
    expect(parsed.data).toBe(result.envelope.data);
  });

  it('ciphertext is non-empty and longer than the minimum (IV + tag)', async () => {
    const result = await createBackup(emptyDump(), 'backup-password-123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(atob(result.envelope.data).length).toBeGreaterThan(12 + 16);
  });
});
