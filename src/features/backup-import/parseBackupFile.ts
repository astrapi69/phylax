/**
 * Parse a `.phylax` backup file's outer envelope.
 *
 * This stage only validates the JSON envelope shape and format-level
 * constraints. Cryptographic validation (decrypt + payload JSON parse)
 * happens in `decryptBackup.ts` after the user supplies the backup
 * password. See `docs/backup-format.md` for the full specification.
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const SUPPORTED_VERSION = 1;
export const SUPPORTED_TYPE = 'phylax-backup';
export const SUPPORTED_ALGORITHM = 'AES-256-GCM';
export const SUPPORTED_KDF = 'PBKDF2-SHA256';
export const SALT_BYTE_LENGTH = 32;
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 10_000_000;

export interface ParsedPhylaxFile {
  version: 1;
  type: 'phylax-backup';
  created: string;
  source: { app: string; appVersion: string };
  crypto: {
    algorithm: 'AES-256-GCM';
    kdf: 'PBKDF2-SHA256';
    iterations: number;
    salt: string;
  };
  data: string;
}

export interface BackupMetadata {
  fileName: string;
  fileSizeBytes: number;
  created: string;
  sourceAppVersion: string;
}

export type ParseError =
  | { kind: 'invalid-json' }
  | { kind: 'missing-field'; field: string }
  | { kind: 'unsupported-version'; version: unknown }
  | { kind: 'wrong-type'; got: unknown }
  | { kind: 'too-large'; sizeMb: number }
  | { kind: 'corrupted'; detail: string };

export type ParseResult =
  | { valid: true; parsed: ParsedPhylaxFile; metadata: BackupMetadata }
  | { valid: false; error: ParseError };

const REQUIRED_FIELDS: ReadonlyArray<string> = [
  'version',
  'type',
  'created',
  'source',
  'crypto',
  'data',
];

const REQUIRED_CRYPTO_FIELDS: ReadonlyArray<string> = ['algorithm', 'kdf', 'iterations', 'salt'];

function hasKey<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

function decodeBase64Length(b64: string): number | null {
  try {
    return atob(b64).length;
  } catch {
    return null;
  }
}

/**
 * Read a File as UTF-8 text. Uses `File.text()` when available and
 * falls back to `FileReader.readAsText` otherwise. The fallback path
 * exists for jsdom test environments where `File.text` is not
 * implemented; modern browsers have `File.text()` natively.
 */
function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

/**
 * Parse + validate a `.phylax` file. Does not decrypt; only checks
 * format-level invariants. Returns typed errors for the UI layer to
 * render via i18next.
 */
export async function parseBackupFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: { kind: 'too-large', sizeMb: Math.round(file.size / (1024 * 1024)) },
    };
  }

  let text: string;
  try {
    text = await readFileAsText(file);
  } catch {
    return { valid: false, error: { kind: 'invalid-json' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, error: { kind: 'invalid-json' } };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { valid: false, error: { kind: 'invalid-json' } };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!hasKey(parsed, field)) {
      return { valid: false, error: { kind: 'missing-field', field } };
    }
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.type !== SUPPORTED_TYPE) {
    return { valid: false, error: { kind: 'wrong-type', got: obj.type } };
  }

  if (obj.version !== SUPPORTED_VERSION) {
    return { valid: false, error: { kind: 'unsupported-version', version: obj.version } };
  }

  if (typeof obj.created !== 'string') {
    return { valid: false, error: { kind: 'missing-field', field: 'created' } };
  }

  const source = obj.source;
  if (
    !hasKey(source, 'app') ||
    !hasKey(source, 'appVersion') ||
    typeof (source as Record<string, unknown>).app !== 'string' ||
    typeof (source as Record<string, unknown>).appVersion !== 'string'
  ) {
    return { valid: false, error: { kind: 'missing-field', field: 'source' } };
  }

  const cryptoObj = obj.crypto;
  for (const field of REQUIRED_CRYPTO_FIELDS) {
    if (!hasKey(cryptoObj, field)) {
      return { valid: false, error: { kind: 'missing-field', field: `crypto.${field}` } };
    }
  }
  const c = cryptoObj as Record<string, unknown>;

  if (c.algorithm !== SUPPORTED_ALGORITHM) {
    return {
      valid: false,
      error: { kind: 'corrupted', detail: `unsupported algorithm: ${String(c.algorithm)}` },
    };
  }
  if (c.kdf !== SUPPORTED_KDF) {
    return {
      valid: false,
      error: { kind: 'corrupted', detail: `unsupported kdf: ${String(c.kdf)}` },
    };
  }
  if (typeof c.iterations !== 'number' || !Number.isInteger(c.iterations)) {
    return { valid: false, error: { kind: 'corrupted', detail: 'iterations not an integer' } };
  }
  if (c.iterations < MIN_ITERATIONS || c.iterations > MAX_ITERATIONS) {
    return {
      valid: false,
      error: { kind: 'corrupted', detail: `iterations out of range: ${c.iterations}` },
    };
  }
  if (typeof c.salt !== 'string') {
    return { valid: false, error: { kind: 'missing-field', field: 'crypto.salt' } };
  }
  const saltLen = decodeBase64Length(c.salt);
  if (saltLen === null) {
    return { valid: false, error: { kind: 'corrupted', detail: 'salt base64 invalid' } };
  }
  if (saltLen !== SALT_BYTE_LENGTH) {
    return {
      valid: false,
      error: {
        kind: 'corrupted',
        detail: `salt length ${saltLen} != ${SALT_BYTE_LENGTH}`,
      },
    };
  }

  if (typeof obj.data !== 'string') {
    return { valid: false, error: { kind: 'missing-field', field: 'data' } };
  }
  const dataLen = decodeBase64Length(obj.data);
  if (dataLen === null) {
    return { valid: false, error: { kind: 'corrupted', detail: 'data base64 invalid' } };
  }
  if (dataLen < 12 + 16) {
    return {
      valid: false,
      error: { kind: 'corrupted', detail: `data too short: ${dataLen} bytes` },
    };
  }

  const typed: ParsedPhylaxFile = {
    version: 1,
    type: 'phylax-backup',
    created: obj.created as string,
    source: {
      app: (source as Record<string, unknown>).app as string,
      appVersion: (source as Record<string, unknown>).appVersion as string,
    },
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: c.iterations,
      salt: c.salt,
    },
    data: obj.data,
  };

  return {
    valid: true,
    parsed: typed,
    metadata: {
      fileName: file.name,
      fileSizeBytes: file.size,
      created: typed.created,
      sourceAppVersion: typed.source.appVersion,
    },
  };
}

/** Base64 decode to Uint8Array. Exported for use by decryptBackup. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
