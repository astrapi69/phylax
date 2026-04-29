import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { saveAppSettings } from '../../db/appSettings';
import { useSavedAutoLockMinutes } from './useSavedAutoLockMinutes';
import { DEFAULT_SETTINGS } from '../../db/settings';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
});

describe('useSavedAutoLockMinutes', () => {
  it('returns DEFAULT while keystore is locked at mount', () => {
    const { result } = renderHook(() => useSavedAutoLockMinutes());
    expect(result.current).toBe(DEFAULT_SETTINGS.autoLockMinutes);
  });

  it('reads the persisted value once the keystore is unlocked', async () => {
    await unlockSession();
    await saveAppSettings({ autoLockMinutes: 30 });
    const { result } = renderHook(() => useSavedAutoLockMinutes());
    await waitFor(() => expect(result.current).toBe(30));
  });

  it('re-reads after a lock-and-unlock cycle picks up a new persisted value', async () => {
    await unlockSession();
    await saveAppSettings({ autoLockMinutes: 15 });

    const { result } = renderHook(() => useSavedAutoLockMinutes());
    await waitFor(() => expect(result.current).toBe(15));

    // User changes the value while the hook is mounted.
    await saveAppSettings({ autoLockMinutes: 60 });
    // Hook does NOT live-update — value stays at the previous read
    // until the next unlock event re-fires the load (P-05
    // apply-on-reload semantic).
    expect(result.current).toBe(15);

    // Lock-and-unlock cycle: the listener fires on the unlock
    // transition, the hook re-reads.
    await act(async () => {
      lock();
      await unlockSession();
    });
    await waitFor(() => expect(result.current).toBe(60));
  });

  it('returns the default when no settings have been persisted', async () => {
    await unlockSession();
    const { result } = renderHook(() => useSavedAutoLockMinutes());
    await waitFor(() => expect(result.current).toBe(DEFAULT_SETTINGS.autoLockMinutes));
  });
});
