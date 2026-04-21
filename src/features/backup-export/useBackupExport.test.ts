import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import { lock, unlockWithKey, deriveKeyFromPassword } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository } from '../../db/repositories';
import { useBackupExport, MIN_PASSWORD_LENGTH } from './useBackupExport';

const TEST_PASSWORD = 'vault-password-long';

async function unlockWithStoredKey(): Promise<void> {
  const meta = await readMeta();
  const saltBytes = new Uint8Array(meta?.salt ?? new ArrayBuffer(0));
  const key = await deriveKeyFromPassword(TEST_PASSWORD, saltBytes);
  unlockWithKey(key);
}

async function setupWithProfile(): Promise<void> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockWithStoredKey();
  const repo = new ProfileRepository();
  await repo.create({
    baseData: {
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  });
}

beforeEach(async () => {
  // jsdom lacks URL.createObjectURL; install shims so the download
  // side effect in useBackupExport's ready effect does not throw.
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
      'blob:mock';
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = () => {};
  }
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

describe('useBackupExport', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useBackupExport());
    expect(result.current.state.kind).toBe('idle');
  });

  it('rejects a password shorter than the minimum length', async () => {
    await setupWithProfile();
    const { result } = renderHook(() => useBackupExport());
    await act(async () => {
      await result.current.runExport('short');
    });
    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('password-too-short');
    }
  });

  it('exports successfully and transitions to downloaded', async () => {
    await setupWithProfile();
    const { result } = renderHook(() => useBackupExport());
    await act(async () => {
      await result.current.runExport('export-password-123');
    });
    await waitFor(() => expect(result.current.state.kind).toBe('downloaded'));
    if (result.current.state.kind === 'downloaded') {
      expect(result.current.state.filename).toMatch(/^phylax-backup-\d{8}-\d{6}\.phylax$/);
    }
  });

  it('surfaces locked when the keystore is locked', async () => {
    lock();
    const { result } = renderHook(() => useBackupExport());
    await act(async () => {
      await result.current.runExport('export-password-123');
    });
    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('locked');
    }
  });

  it('surfaces no-profile when no profile exists yet', async () => {
    lock();
    await setupCompletedOnboarding(TEST_PASSWORD);
    await unlockWithStoredKey();

    const { result } = renderHook(() => useBackupExport());
    await act(async () => {
      await result.current.runExport('export-password-123');
    });
    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('no-profile');
    }
  });

  it('reset() returns to idle from any state', async () => {
    await setupWithProfile();
    const { result } = renderHook(() => useBackupExport());
    await act(async () => {
      await result.current.runExport('bad');
    });
    expect(result.current.state.kind).toBe('error');
    act(() => result.current.reset());
    expect(result.current.state.kind).toBe('idle');
  });

  it('exposes MIN_PASSWORD_LENGTH as 12', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });
});
