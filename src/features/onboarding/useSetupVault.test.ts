import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useSetupVault } from './useSetupVault';
import { getLockState, lock } from '../../crypto';
import { db } from '../../db/schema';
import { resetDatabase } from '../../db/test-helpers';

beforeEach(async () => {
  lock();
  await resetDatabase();
});

describe('useSetupVault', () => {
  it('starts in idle state with no error', () => {
    const { result } = renderHook(() => useSetupVault());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeUndefined();
  });

  it('transitions to done after a successful setup run', async () => {
    const { result } = renderHook(() => useSetupVault());

    await act(async () => {
      await result.current.runSetup('setup-password-12');
    });

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.error).toBeUndefined();
  });

  it('unlocks the keystore during setup', async () => {
    const { result } = renderHook(() => useSetupVault());

    await act(async () => {
      await result.current.runSetup('setup-password-12');
    });

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(getLockState()).toBe('unlocked');
  });

  it('writes the meta row to Dexie', async () => {
    const { result } = renderHook(() => useSetupVault());

    await act(async () => {
      await result.current.runSetup('setup-password-12');
    });

    await waitFor(() => expect(result.current.status).toBe('done'));
    const metaCount = await db.meta.count();
    expect(metaCount).toBe(1);
  });

  it('does not expose the key or raw password on the hook', () => {
    const { result } = renderHook(() => useSetupVault());
    const keys = Object.keys(result.current);
    expect(keys).toEqual(expect.arrayContaining(['status', 'error', 'runSetup']));
    expect(keys).not.toContain('password');
    expect(keys).not.toContain('key');
  });
});
