import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { getLockState, lock } from '../../crypto';
import { resetDatabase, setupCompletedOnboarding } from '../../db/test-helpers';
import { useUnlock } from './useUnlock';

const TEST_PASSWORD = 'test-password-12';
const onUnlocked = vi.fn();

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  onUnlocked.mockReset();
});

describe('useUnlock', () => {
  it('initial state is idle', () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));
    expect(result.current.state).toBe('idle');
    expect(result.current.password).toBe('');
  });

  it('setting password transitions to entering', () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('a'));

    expect(result.current.state).toBe('entering');
  });

  it('correct password transitions to done', async () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword(TEST_PASSWORD));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe('done');
    expect(onUnlocked).toHaveBeenCalledOnce();
  });

  it('wrong password transitions to error', async () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('wrong-password1'));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('wrong-password');
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('on error, keyStore is locked', async () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('wrong-password1'));

    await act(async () => {
      await result.current.submit();
    });

    expect(getLockState()).toBe('locked');
  });

  it('on error, setting password clears error and returns to entering', async () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('wrong-password1'));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe('error');

    act(() => result.current.setPassword('retry'));

    expect(result.current.state).toBe('entering');
    expect(result.current.error).toBeUndefined();
  });

  it('on done, keyStore is unlocked', async () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword(TEST_PASSWORD));
    await act(async () => {
      await result.current.submit();
    });

    expect(getLockState()).toBe('unlocked');
    lock();
  });

  it('throws if no meta row exists', async () => {
    await resetDatabase();

    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('anything1234'));

    await expect(
      act(async () => {
        await result.current.submit();
      }),
    ).rejects.toThrow('No meta row found');
  });
});
