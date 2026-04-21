/**
 * Serialize a VaultDump, encrypt it with a key derived from the
 * user-supplied backup password + a fresh salt, and assemble the
 * outer `.phylax` envelope.
 *
 * The salt MUST be freshly generated per export, even if the user
 * re-uses their master password (see docs/backup-format.md
 * "Salt-Generierung"). The derived key is discarded after encryption;
 * the user's in-memory vault key is never touched.
 */

import { deriveKeyFromPassword, encrypt, generateSalt } from '../../crypto';
import { PBKDF2_ITERATIONS } from '../../crypto/constants';
import {
  SUPPORTED_ALGORITHM,
  SUPPORTED_KDF,
  SUPPORTED_TYPE,
  SUPPORTED_VERSION,
} from '../backup-import/parseBackupFile';
import type { VaultDump } from '../backup-import/decryptBackup';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export interface BackupEnvelope {
  version: 1;
  type: 'phylax-backup';
  created: string;
  source: { app: 'phylax'; appVersion: string };
  crypto: {
    algorithm: 'AES-256-GCM';
    kdf: 'PBKDF2-SHA256';
    iterations: number;
    salt: string;
  };
  data: string;
}

export type CreateBackupError =
  | { kind: 'encryption-failed'; detail: string }
  | { kind: 'crypto-unavailable' };

export type CreateBackupResult =
  | { ok: true; envelope: BackupEnvelope; json: string }
  | { ok: false; error: CreateBackupError };

/**
 * Derive a fresh key from `password`, encrypt the serialized dump,
 * and return the envelope plus its JSON text.
 *
 * `now` is injected for deterministic tests. Defaults to wall clock.
 */
export async function createBackup(
  dump: VaultDump,
  password: string,
  now: Date = new Date(),
): Promise<CreateBackupResult> {
  if (!globalThis.crypto?.subtle) {
    return { ok: false, error: { kind: 'crypto-unavailable' } };
  }

  try {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword(password, salt, PBKDF2_ITERATIONS);

    const innerJson = JSON.stringify(dump);
    const plaintext = new TextEncoder().encode(innerJson);
    const ciphertext = await encrypt(key, plaintext);

    const envelope: BackupEnvelope = {
      version: SUPPORTED_VERSION,
      type: SUPPORTED_TYPE,
      created: now.toISOString(),
      source: {
        app: 'phylax',
        appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
      },
      crypto: {
        algorithm: SUPPORTED_ALGORITHM,
        kdf: SUPPORTED_KDF,
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
      },
      data: bytesToBase64(new Uint8Array(ciphertext)),
    };

    return { ok: true, envelope, json: JSON.stringify(envelope) };
  } catch (err) {
    return { ok: false, error: { kind: 'encryption-failed', detail: String(err) } };
  }
}
