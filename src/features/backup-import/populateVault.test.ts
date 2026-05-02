import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import {
  generateSalt,
  deriveKeyFromPassword,
  decryptWithStoredKey,
  unlockWithKey,
  lock,
} from '../../crypto';
import { db } from '../../db/schema';
import { readMeta, VERIFICATION_TOKEN } from '../../db/meta';
import { decodeMetaPayload } from '../../db/settings';
import { resetDatabase } from '../../db/test-helpers';
import { populateVault } from './populateVault';
import type { VaultDump } from './decryptBackup';

beforeEach(async () => {
  lock();
  await resetDatabase();
});

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
    meta_settings: { settings: { autoLockMinutes: 7 } },
  };
}

describe('populateVault', () => {
  it('writes the meta row and inherits settings', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('backup-password-x', salt);

    const result = await populateVault(emptyDump(), key, salt);

    expect(result.ok).toBe(true);
    const meta = await readMeta();
    expect(meta).not.toBeNull();
    if (!meta) throw new Error('meta row missing');
    expect(meta.salt.byteLength).toBe(32);

    unlockWithKey(key);
    const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
    const payload = decodeMetaPayload(decrypted);
    expect(payload.verificationToken).toBe(VERIFICATION_TOKEN);
    expect(payload.settings.autoLockMinutes).toBe(7);
    lock();
  });

  it('writes rows into the correct tables', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('backup-password-y', salt);

    const dump = emptyDump();
    dump.rows.profiles = [{ id: 'p1', profileId: 'p1', createdAt: 1, updatedAt: 2, name: 'Alice' }];
    dump.rows.observations = [
      { id: 'o1', profileId: 'p1', createdAt: 1, updatedAt: 2, theme: 'test' },
      { id: 'o2', profileId: 'p1', createdAt: 3, updatedAt: 4, theme: 'test2' },
    ];

    const result = await populateVault(dump, key, salt);
    expect(result.ok).toBe(true);

    const profileCount = await db.profiles.count();
    const observationCount = await db.observations.count();
    expect(profileCount).toBe(1);
    expect(observationCount).toBe(2);
  });

  it('clears existing data before writing (overwrite semantics)', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('backup-password-z', salt);

    // Seed some data directly.
    await db.profiles.put({
      id: 'old',
      profileId: 'old',
      createdAt: 1,
      updatedAt: 1,
      payload: new Uint8Array([1, 2, 3]).buffer,
    });
    expect(await db.profiles.count()).toBe(1);

    await populateVault(emptyDump(), key, salt);
    expect(await db.profiles.count()).toBe(0);
  });

  it('round-trips: written rows can be decrypted with the same key', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('backup-password-w', salt);

    const dump = emptyDump();
    dump.rows.profiles = [
      {
        id: 'p1',
        profileId: 'p1',
        createdAt: 10,
        updatedAt: 20,
        name: 'Bob',
        age: 40,
      },
    ];

    await populateVault(dump, key, salt);
    unlockWithKey(key);

    const rows = await db.profiles.toArray();
    expect(rows.length).toBe(1);
    const firstRow = rows[0];
    if (!firstRow) throw new Error('row missing');
    const decrypted = await decryptWithStoredKey(new Uint8Array(firstRow.payload));
    const parsed = JSON.parse(new TextDecoder().decode(decrypted));
    expect(parsed.id).toBe('p1');
    expect(parsed.name).toBe('Bob');
    expect(parsed.age).toBe(40);
    lock();
  });

  it('handles empty dump (all tables empty)', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('backup-password-empty', salt);

    const result = await populateVault(emptyDump(), key, salt);
    expect(result.ok).toBe(true);
    expect(await db.profiles.count()).toBe(0);
    expect(await db.observations.count()).toBe(0);
    expect(await db.meta.count()).toBe(1);
  });

  it('writes one row into every supported table (covers all TABLE_FOR accessors)', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('backup-password-all-tables', salt);

    const dump = emptyDump();
    dump.rows.profiles = [{ id: 'p1', profileId: 'p1', createdAt: 1, updatedAt: 1 }];
    dump.rows.observations = [{ id: 'o1', profileId: 'p1', createdAt: 2, updatedAt: 2 }];
    dump.rows.lab_values = [{ id: 'lv1', profileId: 'p1', createdAt: 3, updatedAt: 3 }];
    dump.rows.lab_reports = [{ id: 'lr1', profileId: 'p1', createdAt: 4, updatedAt: 4 }];
    dump.rows.supplements = [{ id: 's1', profileId: 'p1', createdAt: 5, updatedAt: 5 }];
    dump.rows.open_points = [{ id: 'op1', profileId: 'p1', createdAt: 6, updatedAt: 6 }];
    dump.rows.profile_versions = [{ id: 'pv1', profileId: 'p1', createdAt: 7, updatedAt: 7 }];
    dump.rows.documents = [{ id: 'd1', profileId: 'p1', createdAt: 8, updatedAt: 8 }];
    dump.rows.timeline_entries = [{ id: 't1', profileId: 'p1', createdAt: 9, updatedAt: 9 }];

    const result = await populateVault(dump, key, salt);
    expect(result.ok).toBe(true);

    expect(await db.profiles.count()).toBe(1);
    expect(await db.observations.count()).toBe(1);
    expect(await db.labValues.count()).toBe(1);
    expect(await db.labReports.count()).toBe(1);
    expect(await db.supplements.count()).toBe(1);
    expect(await db.openPoints.count()).toBe(1);
    expect(await db.profileVersions.count()).toBe(1);
    expect(await db.documents.count()).toBe(1);
    expect(await db.timelineEntries.count()).toBe(1);
  });

  it('returns write-failed when the Dexie transaction throws', async () => {
    // Force the underlying transaction to reject so the catch branch
    // (line 136 of populateVault.ts) executes. Replace
    // db.transaction with a stub for the duration of the test.
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('backup-password-fail', salt);

    // Dexie's `transaction` is overloaded; bypass the overload-set
    // typecheck by replacing the property directly. Restore
    // afterwards.
    const dbAny = db as unknown as { transaction: unknown };
    const original = dbAny.transaction;
    dbAny.transaction = () => {
      throw new Error('simulated quota exceeded');
    };
    try {
      const result = await populateVault(emptyDump(), key, salt);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('write-failed');
        expect(result.error.detail).toContain('simulated quota exceeded');
      }
    } finally {
      dbAny.transaction = original;
    }
  });
});
