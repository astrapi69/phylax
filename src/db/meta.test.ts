import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  writeMeta,
  readMeta,
  metaExists,
  META_ID,
  VERIFICATION_TOKEN,
  CURRENT_SCHEMA_VERSION,
} from './meta';
import { resetDatabase } from './test-helpers';
import {
  generateSalt,
  deriveKeyFromPassword,
  unlockWithKey,
  encryptWithStoredKey,
  decryptWithStoredKey,
  lock,
} from '../crypto';

beforeEach(async () => {
  lock();
  await resetDatabase();
});

describe('meta helper', () => {
  it('metaExists returns false on empty DB', async () => {
    expect(await metaExists()).toBe(false);
  });

  it('writeMeta and readMeta round-trip', async () => {
    const salt = generateSalt();
    const payload = new ArrayBuffer(16);

    await writeMeta(new Uint8Array(salt).buffer, payload);
    const row = await readMeta();

    expect(row).not.toBeNull();
    expect(row?.id).toBe(META_ID);
    expect(row?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(new Uint8Array(row?.salt ?? new ArrayBuffer(0))).toEqual(salt);
  });

  it('metaExists returns true after writeMeta', async () => {
    await writeMeta(new ArrayBuffer(32), new ArrayBuffer(0));
    expect(await metaExists()).toBe(true);
  });

  it('writeMeta overwrites existing (singleton pattern)', async () => {
    await writeMeta(new ArrayBuffer(32), new ArrayBuffer(0));
    const newSalt = new ArrayBuffer(32);
    new Uint8Array(newSalt).fill(0xff);
    await writeMeta(newSalt, new ArrayBuffer(0));

    const row = await readMeta();
    expect(new Uint8Array(row?.salt ?? new ArrayBuffer(0))[0]).toBe(0xff);
  });

  it('verification token round-trips through encryption', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('test-password', salt);
    unlockWithKey(key);

    const encoded = new TextEncoder().encode(VERIFICATION_TOKEN);
    const encrypted = await encryptWithStoredKey(encoded);
    await writeMeta(new Uint8Array(salt).buffer, new Uint8Array(encrypted).buffer);

    const row = await readMeta();
    expect(row).not.toBeNull();

    const decrypted = await decryptWithStoredKey(
      new Uint8Array(row?.payload ?? new ArrayBuffer(0)),
    );
    const decoded = new TextDecoder().decode(decrypted);
    expect(decoded).toBe(VERIFICATION_TOKEN);

    lock();
  });
});
