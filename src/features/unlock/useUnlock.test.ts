import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { getLockState, lock } from '../../crypto';
import { resetDatabase, setupCompletedOnboarding } from '../../db/test-helpers';
import { useUnlock } from './useUnlock';
import { STORAGE_KEY, recordFailedAttempt, getRateLimitState } from './rateLimit';

const TEST_PASSWORD = 'test-password-12';
const onUnlocked = vi.fn();

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  onUnlocked.mockReset();
  sessionStorage.removeItem(STORAGE_KEY);
});

describe('useUnlock', () => {
  it('initial state is idle', () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));
    expect(result.current.state).toBe('idle');
    expect(result.current.password).toBe('');
    expect(result.current.remainingLockoutMs).toBe(0);
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

  it('surfaces no-meta error without throwing when meta row missing', async () => {
    await resetDatabase();

    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('anything1234'));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('no-meta');
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('wrong password increments failedAttempts', async () => {
    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('wrong-password1'));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.failedAttempts).toBe(1);
    expect(getRateLimitState().failedAttempts).toBe(1);
  });

  it('4th wrong password triggers lockout with remainingLockoutMs > 0', async () => {
    recordFailedAttempt();
    recordFailedAttempt();
    recordFailedAttempt();

    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword('wrong-password1'));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.failedAttempts).toBe(4);
    expect(result.current.remainingLockoutMs).toBeGreaterThan(0);
    expect(result.current.submitEnabled).toBe(false);
  });

  it('submit is blocked during active lockout', async () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt();

    const { result } = renderHook(() => useUnlock(onUnlocked));
    act(() => result.current.setPassword(TEST_PASSWORD));

    await act(async () => {
      await result.current.submit();
    });

    // Hook stays in entering: submit() returns early before deriving.
    expect(result.current.state).toBe('entering');
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('successful unlock resets rate-limit counter', async () => {
    recordFailedAttempt();
    recordFailedAttempt();

    const { result } = renderHook(() => useUnlock(onUnlocked));

    act(() => result.current.setPassword(TEST_PASSWORD));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe('done');
    expect(getRateLimitState().failedAttempts).toBe(0);
    expect(getRateLimitState().lockedUntil).toBeNull();
    lock();
  });

  it('hook picks up active lockout from sessionStorage on mount', async () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt();

    const { result } = renderHook(() => useUnlock(onUnlocked));

    expect(result.current.remainingLockoutMs).toBeGreaterThan(0);
    expect(result.current.failedAttempts).toBe(4);
    await waitFor(() => {
      expect(result.current.remainingLockoutMs).toBeGreaterThan(0);
    });
  });
});
