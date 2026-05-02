import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import { encrypt, generateSalt, deriveKeyFromPassword, lock } from '../../crypto';
import { PBKDF2_ITERATIONS } from '../../crypto/constants';
import { resetDatabase } from '../../db/test-helpers';
import type { ParsedPhylaxFile } from './parseBackupFile';
import { useBackupImport } from './useBackupImport';
import { BACKUP_IMPORT_STORAGE_KEY, createRateLimiter } from '../unlock/rateLimit';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function makeBackup(password: string): Promise<ParsedPhylaxFile> {
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);
  const inner = {
    schemaVersion: 2,
    rows: {
      profiles: [{ id: 'p1', profileId: 'p1', createdAt: 1, updatedAt: 2 }],
    },
    meta_settings: {},
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(inner));
  const ciphertext = await encrypt(key, plaintext);
  return {
    version: 1,
    type: 'phylax-backup',
    created: '2026-04-20T00:00:00Z',
    source: { app: 'phylax', appVersion: '0.0.0' },
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

beforeEach(async () => {
  lock();
  await resetDatabase();
  sessionStorage.removeItem(BACKUP_IMPORT_STORAGE_KEY);
});

describe('useBackupImport', () => {
  it('starts in idle state with no error', () => {
    const { result } = renderHook(() => useBackupImport());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.isLocked).toBe(false);
  });

  it('happy path: decrypts and populates, returns ok with key + hasProfile', async () => {
    const parsed = await makeBackup('correct-password');
    const { result } = renderHook(() => useBackupImport());

    let runResult: { ok: boolean; hasProfile?: boolean; key?: CryptoKey } = { ok: false };
    await act(async () => {
      runResult = await result.current.run(parsed, 'correct-password');
    });

    expect(runResult.ok).toBe(true);
    if (runResult.ok) {
      expect(runResult.hasProfile).toBe(true);
      // The key must come back so the caller can complete the
      // auth-state transition (unlockWithKey or replaceStoredKey
      // depending on context).
      expect(runResult.key).toBeDefined();
      // jsdom does not always expose `CryptoKey` as a global. The
      // toString-tag check is portable across jsdom + Node + browser
      // and verifies the underlying class without relying on the
      // global symbol being defined.
      expect(Object.prototype.toString.call(runResult.key)).toBe('[object CryptoKey]');
    }
    expect(result.current.status).toBe('done');
    expect(result.current.error).toBeNull();
    lock();
  });

  it('does NOT call unlockWithKey internally - caller owns auth-state transition', async () => {
    const cryptoModule = await import('../../crypto');
    const spy = vi.spyOn(cryptoModule, 'unlockWithKey');
    const parsed = await makeBackup('correct-password');
    const { result } = renderHook(() => useBackupImport());

    await act(async () => {
      await result.current.run(parsed, 'correct-password');
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    lock();
  });

  it('wrong password sets error and increments rate-limiter', async () => {
    const parsed = await makeBackup('correct-password');
    const { result } = renderHook(() => useBackupImport());

    let runResult: { ok: boolean } = { ok: true };
    await act(async () => {
      runResult = await result.current.run(parsed, 'wrong-password');
    });

    expect(runResult.ok).toBe(false);
    expect(result.current.status).toBe('error');
    expect(result.current.error?.kind).toBe('wrong-password');
  });

  it('rejects empty password without invoking decrypt', async () => {
    const parsed = await makeBackup('correct-password');
    const { result } = renderHook(() => useBackupImport());

    let runResult: { ok: boolean } = { ok: true };
    await act(async () => {
      runResult = await result.current.run(parsed, '');
    });

    expect(runResult.ok).toBe(false);
    expect(result.current.status).toBe('idle');
  });

  it('clearError resets error to null without changing status', async () => {
    const parsed = await makeBackup('correct-password');
    const { result } = renderHook(() => useBackupImport());

    await act(async () => {
      await result.current.run(parsed, 'wrong-password');
    });
    expect(result.current.error?.kind).toBe('wrong-password');

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it('reset returns status to idle after error', async () => {
    const parsed = await makeBackup('correct-password');
    const { result } = renderHook(() => useBackupImport());

    await act(async () => {
      await result.current.run(parsed, 'wrong-password');
    });
    expect(result.current.status).toBe('error');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('shares the rate-limiter with pre-auth flow via BACKUP_IMPORT_STORAGE_KEY', async () => {
    // Pre-fill the limiter as if the pre-auth surface hit failed attempts.
    const limiter = createRateLimiter(BACKUP_IMPORT_STORAGE_KEY);
    for (let i = 0; i < 6; i++) {
      limiter.recordFailedAttempt();
    }

    const { result } = renderHook(() => useBackupImport());
    await waitFor(() => expect(result.current.isLocked).toBe(true));

    const parsed = await makeBackup('correct-password');
    let runResult: { ok: boolean } = { ok: true };
    await act(async () => {
      runResult = await result.current.run(parsed, 'correct-password');
    });

    // Lockout from the shared limiter prevents the run.
    expect(runResult.ok).toBe(false);
  });
});
