import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
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
});
