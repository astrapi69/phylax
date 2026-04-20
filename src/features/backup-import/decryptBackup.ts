/**
 * Decrypt a parsed `.phylax` file's payload into a plaintext vault dump.
 *
 * Uses the file's crypto parameters (salt, iterations) for key
 * derivation. Returns typed errors for the UI layer. See
 * `docs/backup-format.md` for the inner payload structure.
 */

import { deriveKeyFromPassword, decrypt } from '../../crypto';
import { base64ToBytes, type ParsedPhylaxFile } from './parseBackupFile';

export const SUPPORTED_INNER_SCHEMA_VERSION = 2;

export type VaultTable =
  | 'profiles'
  | 'observations'
  | 'lab_values'
  | 'lab_reports'
  | 'supplements'
  | 'open_points'
  | 'profile_versions'
  | 'documents'
  | 'timeline_entries';

export const VAULT_TABLES: ReadonlyArray<VaultTable> = [
  'profiles',
  'observations',
  'lab_values',
  'lab_reports',
  'supplements',
  'open_points',
  'profile_versions',
  'documents',
  'timeline_entries',
];

export interface DomainRow {
  id: string;
  profileId: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface MetaSettingsPayload {
  verificationToken?: string;
  settings?: { autoLockMinutes?: number };
  aiProvider?: unknown;
}

export interface VaultDump {
  schemaVersion: number;
  rows: Record<VaultTable, DomainRow[]>;
  meta_settings: MetaSettingsPayload;
}

export type DecryptError =
  | { kind: 'wrong-password' }
  | { kind: 'corrupted'; detail: string }
  | { kind: 'unsupported-inner-schema'; schemaVersion: unknown }
  | { kind: 'crypto-failed'; detail: string };

export type DecryptResult =
  | { ok: true; dump: VaultDump; saltBytes: Uint8Array; key: CryptoKey }
  | { ok: false; error: DecryptError };

function isDomainRow(x: unknown): x is DomainRow {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as DomainRow).id === 'string' &&
    typeof (x as DomainRow).profileId === 'string' &&
    typeof (x as DomainRow).createdAt === 'number' &&
    typeof (x as DomainRow).updatedAt === 'number'
  );
}

/**
 * Derive the key from the backup password + file salt, then decrypt
 * the file's payload, parse the inner JSON, and validate shape. All
 * failure modes are returned as typed errors; the function never
 * throws on expected wrong-password / corrupted-file cases.
 *
 * On success, returns the decoded vault dump plus the derived key
 * and salt bytes, so the caller can pass both to `populateVault`
 * without re-deriving.
 */
export async function decryptBackup(
  parsed: ParsedPhylaxFile,
  password: string,
): Promise<DecryptResult> {
  let saltBytes: Uint8Array;
  try {
    saltBytes = base64ToBytes(parsed.crypto.salt);
  } catch (err) {
    return { ok: false, error: { kind: 'corrupted', detail: `salt decode: ${String(err)}` } };
  }

  let dataBytes: Uint8Array;
  try {
    dataBytes = base64ToBytes(parsed.data);
  } catch (err) {
    return { ok: false, error: { kind: 'corrupted', detail: `data decode: ${String(err)}` } };
  }

  let key: CryptoKey;
  try {
    key = await deriveKeyFromPassword(password, saltBytes, parsed.crypto.iterations);
  } catch (err) {
    return { ok: false, error: { kind: 'crypto-failed', detail: String(err) } };
  }

  let plaintext: Uint8Array;
  try {
    plaintext = await decrypt(key, dataBytes);
  } catch (err) {
    // Web Crypto returns OperationError for both wrong key and
    // tampered ciphertext. For UX, default to wrong-password; the
    // subsequent JSON.parse branch catches structural corruption.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('too short')) {
      return { ok: false, error: { kind: 'corrupted', detail: msg } };
    }
    return { ok: false, error: { kind: 'wrong-password' } };
  }

  let innerText: string;
  try {
    innerText = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch (err) {
    return { ok: false, error: { kind: 'corrupted', detail: `utf-8 decode: ${String(err)}` } };
  }

  let inner: unknown;
  try {
    inner = JSON.parse(innerText);
  } catch {
    return { ok: false, error: { kind: 'corrupted', detail: 'inner payload is not JSON' } };
  }

  if (typeof inner !== 'object' || inner === null) {
    return { ok: false, error: { kind: 'corrupted', detail: 'inner payload not an object' } };
  }

  const innerObj = inner as Record<string, unknown>;

  if (innerObj.schemaVersion !== SUPPORTED_INNER_SCHEMA_VERSION) {
    return {
      ok: false,
      error: { kind: 'unsupported-inner-schema', schemaVersion: innerObj.schemaVersion },
    };
  }

  if (typeof innerObj.rows !== 'object' || innerObj.rows === null) {
    return { ok: false, error: { kind: 'corrupted', detail: 'rows missing' } };
  }

  const rows: Record<VaultTable, DomainRow[]> = {
    profiles: [],
    observations: [],
    lab_values: [],
    lab_reports: [],
    supplements: [],
    open_points: [],
    profile_versions: [],
    documents: [],
    timeline_entries: [],
  };

  const rowsObj = innerObj.rows as Record<string, unknown>;
  for (const table of VAULT_TABLES) {
    const value = rowsObj[table];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      return { ok: false, error: { kind: 'corrupted', detail: `rows.${table} not an array` } };
    }
    for (const row of value) {
      if (!isDomainRow(row)) {
        return {
          ok: false,
          error: { kind: 'corrupted', detail: `rows.${table} contains invalid row` },
        };
      }
    }
    rows[table] = value as DomainRow[];
  }

  const metaSettings =
    typeof innerObj.meta_settings === 'object' && innerObj.meta_settings !== null
      ? (innerObj.meta_settings as MetaSettingsPayload)
      : {};

  return {
    ok: true,
    dump: {
      schemaVersion: SUPPORTED_INNER_SCHEMA_VERSION,
      rows,
      meta_settings: metaSettings,
    },
    saltBytes,
    key,
  };
}
