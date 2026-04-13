import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { getLockState, lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { useAutoLock } from './useAutoLock';

const TEST_PASSWORD = 'test-password-12';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

// Salt cached after first onboarding setup so we can unlock quickly
let cachedSalt: Uint8Array;

beforeEach(async () => {
  // Setup with real timers (PBKDF2 needs real async)
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  cachedSalt = new Uint8Array(meta?.salt ?? new ArrayBuffer(0));
  // NOW switch to fake timers for the actual test
  vi.useFakeTimers();
});

afterEach(() => {
  lock();
  vi.useRealTimers();
});

async function doUnlock() {
  // Temporarily use real timers for PBKDF2
  vi.useRealTimers();
  await unlock(TEST_PASSWORD, cachedSalt);
  vi.useFakeTimers();
}

describe('useAutoLock', () => {
  it('fires lock after timeout', async () => {
    await doUnlock();
    expect(getLockState()).toBe('unlocked');

    renderHook(() => useAutoLock(5));

    vi.advanceTimersByTime(FIVE_MINUTES_MS + 100);
    expect(getLockState()).toBe('locked');
  });

  it('activity resets timer', async () => {
    await doUnlock();
    renderHook(() => useAutoLock(5));

    // Advance 80% of timeout
    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.8);
    expect(getLockState()).toBe('unlocked');

    // Activity event
    document.dispatchEvent(new Event('keydown'));

    // Advance another 80% (total > timeout, but timer was reset)
    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.8);
    expect(getLockState()).toBe('unlocked');

    // Now advance past the full timeout from the last activity
    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.3);
    expect(getLockState()).toBe('locked');
  });

  it('does nothing when locked', () => {
    expect(getLockState()).toBe('locked');

    renderHook(() => useAutoLock(5));

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 10);
    expect(getLockState()).toBe('locked');
  });

  it('starts timer when unlocked externally', async () => {
    renderHook(() => useAutoLock(5));

    // Hook is mounted while locked. Unlock with real timers for PBKDF2...
    vi.useRealTimers();
    await unlock(TEST_PASSWORD, cachedSalt);
    vi.useFakeTimers();

    // The onLockStateChange listener fired during real timers, so the
    // setTimeout was scheduled under real timers. Dispatch an activity event
    // to reset the timer under fake timers.
    document.dispatchEvent(new Event('keydown'));

    vi.advanceTimersByTime(FIVE_MINUTES_MS + 100);
    expect(getLockState()).toBe('locked');
  });

  it('stops timer when locked externally', async () => {
    await doUnlock();
    renderHook(() => useAutoLock(5));

    lock();
    expect(getLockState()).toBe('locked');

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 2);
    expect(getLockState()).toBe('locked');
  });

  it('disabled (timeout=0) does not lock', async () => {
    await doUnlock();
    renderHook(() => useAutoLock(0));

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 100);
    expect(getLockState()).toBe('unlocked');

    lock();
  });

  it('mousemove resets timer', async () => {
    await doUnlock();
    renderHook(() => useAutoLock(5));

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.9);
    document.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.9);
    expect(getLockState()).toBe('unlocked');

    lock();
  });

  it('click resets timer', async () => {
    await doUnlock();
    renderHook(() => useAutoLock(5));

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.9);
    document.dispatchEvent(new Event('click'));
    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.9);
    expect(getLockState()).toBe('unlocked');

    lock();
  });

  it('touchstart resets timer', async () => {
    await doUnlock();
    renderHook(() => useAutoLock(5));

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.9);
    document.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.9);
    expect(getLockState()).toBe('unlocked');

    lock();
  });

  it('scroll does NOT reset timer', async () => {
    await doUnlock();
    renderHook(() => useAutoLock(5));

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.9);
    document.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(FIVE_MINUTES_MS * 0.2);
    expect(getLockState()).toBe('locked');
  });

  it('removes event listeners on unmount', async () => {
    await doUnlock();
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useAutoLock(5));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));

    removeSpy.mockRestore();
    lock();
  });

  it('clears timeout on unmount', async () => {
    await doUnlock();
    const { unmount } = renderHook(() => useAutoLock(5));

    unmount();

    vi.advanceTimersByTime(FIVE_MINUTES_MS * 2);
    expect(getLockState()).toBe('unlocked');

    lock();
  });
});
