/**
 * Vault re-encryption primitive (P-06, ADR-0018).
 *
 * Re-encrypts every row in every encrypted table plus the singleton
 * `meta.payload` from `oldKey` to `newKey`, then atomically swaps the
 * keyStore singleton.
 *
 * Three-phase architecture (ADR-0018):
 *   Phase 1 (pre-stage, outside Dexie tx): decrypt-then-encrypt every
 *     row's `payload` field with local key references. No DB writes.
 *   Phase 2 (atomic Dexie rw transaction over all encrypted tables +
 *     meta): bulkPut the staged rows; meta.put last. Dexie commits
 *     atomically or rolls back.
 *   Phase 3 (in-memory swap): replaceStoredKey(newKey).
 *
 * Crypto-outside-tx is mandatory: Web Crypto returns Promises and Dexie
 * commits a transaction the moment it detects an `await` on a non-Dexie
 * promise. Performing crypto inside the transaction would commit
 * partial work mid-flight.
 *
 * Caller responsibility: pause auto-lock for the duration via the
 * pause primitive (ADR-0018 Section 4). Local key refs in this module
 * survive even if auto-lock fires; the pause is belt-and-suspenders
 * for Phase 3's `replaceStoredKey` precondition.
 *
 * Partial-failure recovery (ADR-0018 Section 6): if Phase 2 commits
 * and Phase 3 throws, the on-disk vault is under newKey but the in-
 * memory key still references oldKey. Caller surfaces a recovery
 * message; user reload + unlock with the new password recovers
 * fully (no data loss).
 */

import type { Table } from 'dexie';
import { decrypt, encrypt, replaceStoredKey } from '../crypto';
import { db } from './schema';
import { META_ID } from './meta';
import type { EncryptedRow, MetaRow, DocumentBlobRow } from './types';

/**
 * Tables whose rows store an encrypted `payload`. Excludes `meta`,
 * which is handled separately because it carries `salt` +
 * `schemaVersion` plaintext fields that must be preserved verbatim.
 *
 * Tuple typed loosely so DocumentBlobRow (different shape than
 * EncryptedRow) can sit alongside the entity tables; bulkPut only
 * needs the `id` index in common, and we always copy the source row's
 * full shape with only `payload` swapped.
 */
function encryptedTables(): Table<EncryptedRow | DocumentBlobRow, string>[] {
  return [
    db.profiles,
    db.observations,
    db.labValues,
    db.labReports,
    db.supplements,
    db.openPoints,
    db.profileVersions,
    db.documents,
    db.documentBlobs,
    db.timelineEntries,
  ] as Table<EncryptedRow | DocumentBlobRow, string>[];
}

async function reEncryptPayload(
  payload: ArrayBuffer,
  oldKey: CryptoKey,
  newKey: CryptoKey,
): Promise<ArrayBuffer> {
  const plaintext = await decrypt(oldKey, new Uint8Array(payload));
  const ciphertext = await encrypt(newKey, plaintext);
  return ciphertext.buffer.slice(
    ciphertext.byteOffset,
    ciphertext.byteOffset + ciphertext.byteLength,
  ) as ArrayBuffer;
}

/**
 * Re-encrypt every encrypted row + meta.payload from oldKey to newKey,
 * then swap the keyStore singleton.
 *
 * Throws if Phase 1 or Phase 2 fails (vault unchanged on disk in both
 * cases). Throws if Phase 3 fails (vault on disk under newKey, in-
 * memory key still oldKey - recoverable by caller per ADR-0018 Section 6).
 *
 * Caller must ensure the keyStore is currently unlocked AND that
 * auto-lock is paused for the duration.
 *
 * @param oldKey CryptoKey under which on-disk payloads were encrypted
 * @param newKey CryptoKey to re-encrypt under
 */
export async function reencryptVault(oldKey: CryptoKey, newKey: CryptoKey): Promise<void> {
  // Phase 1: pre-stage every encrypted row in memory. Meta first so
  // a missing meta row surfaces as a clean precondition error before
  // any (potentially expensive) row iteration begins.
  const metaRow = await db.meta.get(META_ID);
  if (!metaRow) {
    throw new Error('Cannot re-encrypt vault: meta row missing');
  }
  const newMetaPayload = await reEncryptPayload(metaRow.payload, oldKey, newKey);
  const newMetaRow: MetaRow = { ...metaRow, payload: newMetaPayload };

  const tables = encryptedTables();
  const staged: {
    table: Table<EncryptedRow | DocumentBlobRow, string>;
    rows: (EncryptedRow | DocumentBlobRow)[];
  }[] = [];

  for (const table of tables) {
    const rows = await table.toArray();
    const reEncrypted = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        payload: await reEncryptPayload(row.payload, oldKey, newKey),
      })),
    );
    staged.push({ table, rows: reEncrypted });
  }

  // Phase 2: atomic Dexie transaction over all encrypted tables + meta.
  await db.transaction('rw', [...tables, db.meta] as Table<unknown, unknown>[], async () => {
    for (const { table, rows } of staged) {
      await table.bulkPut(rows);
    }
    await db.meta.put(newMetaRow);
  });

  // Phase 3: swap the in-memory key.
  replaceStoredKey(newKey);
}
