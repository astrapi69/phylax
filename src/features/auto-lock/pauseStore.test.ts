import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pauseAutoLock,
  isAutoLockPaused,
  onAutoLockPauseChange,
  __resetAutoLockPauseStateForTests,
} from './pauseStore';

beforeEach(() => {
  __resetAutoLockPauseStateForTests();
});

describe('pauseStore', () => {
  it('initial state is unpaused', () => {
    expect(isAutoLockPaused()).toBe(false);
  });

  it('a single pause + release toggles state', () => {
    const release = pauseAutoLock();
    expect(isAutoLockPaused()).toBe(true);
    release();
    expect(isAutoLockPaused()).toBe(false);
  });

  it('reference counting: timer resumes only after every release', () => {
    const r1 = pauseAutoLock();
    const r2 = pauseAutoLock();
    const r3 = pauseAutoLock();
    expect(isAutoLockPaused()).toBe(true);

    r1();
    expect(isAutoLockPaused()).toBe(true);
    r2();
    expect(isAutoLockPaused()).toBe(true);
    r3();
    expect(isAutoLockPaused()).toBe(false);
  });

  it('release callback is idempotent (double-release is a no-op)', () => {
    const r1 = pauseAutoLock();
    const r2 = pauseAutoLock();
    r1();
    r1();
    r1();
    expect(isAutoLockPaused()).toBe(true);
    r2();
    expect(isAutoLockPaused()).toBe(false);
  });

  it('listeners fire only on transitions (not on nested increments)', () => {
    const listener = vi.fn();
    onAutoLockPauseChange(listener);

    const r1 = pauseAutoLock();
    const r2 = pauseAutoLock();
    const r3 = pauseAutoLock();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(true);

    r1();
    r2();
    expect(listener).toHaveBeenCalledTimes(1);
    r3();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(false);
  });

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn();
    const unsubscribe = onAutoLockPauseChange(listener);
    const r1 = pauseAutoLock();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    r1();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('one listener throwing does not break others', () => {
    const broken = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    onAutoLockPauseChange(broken);
    onAutoLockPauseChange(ok);
    const r = pauseAutoLock();
    expect(ok).toHaveBeenCalledTimes(1);
    r();
  });
});
