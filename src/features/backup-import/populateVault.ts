/**
 * Write a decrypted backup dump into IndexedDB.
 *
 * Pre-encrypts every row and the meta payload BEFORE opening the
 * Dexie transaction (awaiting crypto.subtle inside a transaction
 * causes PrematureCommitError; same lesson as useSetupVault).
 *
 * Destructive: clears every table before writing. Caller must
 * confirm overwrite intent via the UI before invoking.
 */

import { encrypt } from '../../crypto';
import { db } from '../../db/schema';
import type { EncryptedRow } from '../../db/types';
import { META_ID, VERIFICATION_TOKEN } from '../../db/meta';
import { encodeMetaPayload, DEFAULT_SETTINGS, type AppSettings } from '../../db/settings';
import { CURRENT_SCHEMA_VERSION } from '../../db/meta';
import { VAULT_TABLES, type VaultDump, type VaultTable, type DomainRow } from './decryptBackup';

export type PopulateError = { kind: 'write-failed'; detail: string };

export type PopulateResult = { ok: true } | { ok: false; error: PopulateError };

const TABLE_FOR: Record<VaultTable, () => import('dexie').Table<EncryptedRow, string>> = {
  profiles: () => db.profiles,
  observations: () => db.observations,
  lab_values: () => db.labValues,
  lab_reports: () => db.labReports,
  supplements: () => db.supplements,
  open_points: () => db.openPoints,
  profile_versions: () => db.profileVersions,
  documents: () => db.documents,
  timeline_entries: () => db.timelineEntries,
};

async function encryptRow(key: CryptoKey, row: DomainRow): Promise<EncryptedRow> {
  const { id, profileId, createdAt, updatedAt, ...content } = row;
  const contentWithIdentity: Record<string, unknown> = {
    ...content,
    id,
    profileId,
    createdAt,
    updatedAt,
  };
  const json = JSON.stringify(contentWithIdentity);
  const bytes = new TextEncoder().encode(json);
  const encrypted = await encrypt(key, bytes);
  return {
    id,
    profileId,
    createdAt,
    updatedAt,
    payload: new Uint8Array(encrypted).buffer,
  };
}

/**
 * Clear all vault tables, write the new meta row with the
 * backup-derived salt, and re-encrypt every dump row under the
 * backup-derived key.
 */
export async function populateVault(
  dump: VaultDump,
  key: CryptoKey,
  saltBytes: Uint8Array,
): Promise<PopulateResult> {
  try {
    // Stage 1: pre-encrypt all rows outside of a transaction.
    const encryptedByTable: Array<{ table: VaultTable; rows: EncryptedRow[] }> = [];
    for (const table of VAULT_TABLES) {
      const rows = dump.rows[table];
      if (!rows || rows.length === 0) continue;
      const encrypted = await Promise.all(rows.map((r) => encryptRow(key, r)));
      encryptedByTable.push({ table, rows: encrypted });
    }

    // Stage 2: encode + encrypt the meta payload.
    const inheritedSettings: AppSettings = {
      autoLockMinutes:
        typeof dump.meta_settings.settings?.autoLockMinutes === 'number'
          ? dump.meta_settings.settings.autoLockMinutes
          : DEFAULT_SETTINGS.autoLockMinutes,
    };
    const metaPayloadBytes = encodeMetaPayload({
      verificationToken: VERIFICATION_TOKEN,
      settings: inheritedSettings,
    });
    const encryptedMeta = await encrypt(key, metaPayloadBytes);
    const saltBuffer = new Uint8Array(saltBytes).buffer;
    const metaPayloadBuffer = new Uint8Array(encryptedMeta).buffer;

    // Stage 3: single Dexie transaction across all tables.
    await db.transaction(
      'rw',
      [
        db.meta,
        db.profiles,
        db.observations,
        db.labValues,
        db.labReports,
        db.supplements,
        db.openPoints,
        db.profileVersions,
        db.documents,
        db.timelineEntries,
      ],
      async () => {
        await Promise.all([
          db.meta.clear(),
          db.profiles.clear(),
          db.observations.clear(),
          db.labValues.clear(),
          db.labReports.clear(),
          db.supplements.clear(),
          db.openPoints.clear(),
          db.profileVersions.clear(),
          db.documents.clear(),
          db.timelineEntries.clear(),
        ]);

        await db.meta.put({
          id: META_ID,
          salt: saltBuffer,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          payload: metaPayloadBuffer,
        });

        for (const { table, rows } of encryptedByTable) {
          await TABLE_FOR[table]().bulkPut(rows);
        }
      },
    );

    return { ok: true };
  } catch (err) {
    return { ok: false, error: { kind: 'write-failed', detail: String(err) } };
  }
}
