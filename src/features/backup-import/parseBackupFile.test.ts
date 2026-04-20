import { describe, it, expect } from 'vitest';
import { parseBackupFile, base64ToBytes, MAX_FILE_SIZE_BYTES } from './parseBackupFile';

function validBase64(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) bytes[i] = i & 0xff;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function makeFile(content: string, name = 'backup.phylax', sizeOverride?: number): File {
  const file = new File([content], name, { type: 'application/json' });
  if (sizeOverride !== undefined) {
    Object.defineProperty(file, 'size', { value: sizeOverride });
  }
  return file;
}

function validEnvelope() {
  return {
    version: 1,
    type: 'phylax-backup',
    created: '2026-04-20T15:30:00Z',
    source: { app: 'phylax', appVersion: '0.0.0' },
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: 1_200_000,
      salt: validBase64(32),
    },
    data: validBase64(64),
  };
}

describe('parseBackupFile', () => {
  it('accepts a valid v1 envelope', async () => {
    const file = makeFile(JSON.stringify(validEnvelope()));
    const result = await parseBackupFile(file);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.parsed.version).toBe(1);
      expect(result.parsed.type).toBe('phylax-backup');
      expect(result.metadata.fileName).toBe('backup.phylax');
      expect(result.metadata.sourceAppVersion).toBe('0.0.0');
    }
  });

  it('rejects invalid JSON', async () => {
    const file = makeFile('not-json');
    const result = await parseBackupFile(file);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.kind).toBe('invalid-json');
  });

  it('rejects missing type field', async () => {
    const env = validEnvelope() as Partial<ReturnType<typeof validEnvelope>>;
    delete env.type;
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.kind).toBe('missing-field');
    }
  });

  it('rejects wrong type value', async () => {
    const env = { ...validEnvelope(), type: 'other-backup' };
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.kind).toBe('wrong-type');
      if (result.error.kind === 'wrong-type') {
        expect(result.error.got).toBe('other-backup');
      }
    }
  });

  it('rejects unsupported version', async () => {
    const env = { ...validEnvelope(), version: 2 };
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.kind).toBe('unsupported-version');
    }
  });

  it('rejects missing crypto.salt', async () => {
    const env = validEnvelope();
    delete (env.crypto as Partial<typeof env.crypto>).salt;
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.kind).toBe('missing-field');
      if (result.error.kind === 'missing-field') {
        expect(result.error.field).toBe('crypto.salt');
      }
    }
  });

  it('rejects salt of wrong byte length', async () => {
    const env = {
      ...validEnvelope(),
      crypto: { ...validEnvelope().crypto, salt: validBase64(16) },
    };
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.kind).toBe('corrupted');
  });

  it('rejects iterations below the floor', async () => {
    const env = { ...validEnvelope(), crypto: { ...validEnvelope().crypto, iterations: 1000 } };
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.kind).toBe('corrupted');
  });

  it('rejects iterations above the ceiling', async () => {
    const env = {
      ...validEnvelope(),
      crypto: { ...validEnvelope().crypto, iterations: 50_000_000 },
    };
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.kind).toBe('corrupted');
  });

  it('rejects data too short for IV + auth tag', async () => {
    const env = { ...validEnvelope(), data: validBase64(16) };
    const result = await parseBackupFile(makeFile(JSON.stringify(env)));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.kind).toBe('corrupted');
  });

  it('rejects file above size limit', async () => {
    const env = validEnvelope();
    const file = makeFile(JSON.stringify(env), 'big.phylax', MAX_FILE_SIZE_BYTES + 1);
    const result = await parseBackupFile(file);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.kind).toBe('too-large');
  });

  it('base64ToBytes round-trips', () => {
    const b64 = validBase64(32);
    const bytes = base64ToBytes(b64);
    expect(bytes.length).toBe(32);
    expect(bytes[0]).toBe(0);
    expect(bytes[1]).toBe(1);
    expect(bytes[31]).toBe(31);
  });
});
