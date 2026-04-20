import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRateLimitState,
  getRemainingLockoutMs,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  delayForAttempt,
  BASE_DELAY_MS,
  MAX_DELAY_MS,
  STORAGE_KEY,
} from './rateLimit';

beforeEach(() => {
  sessionStorage.removeItem(STORAGE_KEY);
});

describe('rateLimit', () => {
  it('starts with 0 attempts and no lockout', () => {
    const state = getRateLimitState();
    expect(state.failedAttempts).toBe(0);
    expect(state.lockedUntil).toBeNull();
    expect(getRemainingLockoutMs()).toBe(0);
  });

  it('increments counter without lockout for attempts 1-3', () => {
    const s1 = recordFailedAttempt();
    expect(s1.failedAttempts).toBe(1);
    expect(s1.lockedUntil).toBeNull();

    const s2 = recordFailedAttempt();
    expect(s2.failedAttempts).toBe(2);
    expect(s2.lockedUntil).toBeNull();

    const s3 = recordFailedAttempt();
    expect(s3.failedAttempts).toBe(3);
    expect(s3.lockedUntil).toBeNull();
  });

  it('attempt 4 triggers 2s lockout relative to time of failure', () => {
    const now = 1_000_000;
    recordFailedAttempt(now);
    recordFailedAttempt(now);
    recordFailedAttempt(now);
    const state = recordFailedAttempt(now);

    expect(state.failedAttempts).toBe(4);
    expect(state.lockedUntil).toBe(now + BASE_DELAY_MS);
    expect(getRemainingLockoutMs(now)).toBe(BASE_DELAY_MS);
    expect(getRemainingLockoutMs(now + BASE_DELAY_MS + 1)).toBe(0);
  });

  it('attempt 5 triggers 4s lockout (exponential)', () => {
    const now = 2_000_000;
    for (let i = 0; i < 5; i++) recordFailedAttempt(now);
    const state = getRateLimitState();
    expect(state.failedAttempts).toBe(5);
    expect(state.lockedUntil).toBe(now + 4000);
  });

  it('caps lockout at 60s for attempt 9+', () => {
    const now = 3_000_000;
    for (let i = 0; i < 9; i++) recordFailedAttempt(now);
    expect(getRateLimitState().lockedUntil).toBe(now + MAX_DELAY_MS);

    for (let i = 0; i < 5; i++) recordFailedAttempt(now);
    expect(getRateLimitState().lockedUntil).toBe(now + MAX_DELAY_MS);
  });

  it('recordSuccessfulAttempt resets counter and clears lockout', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt();
    expect(getRateLimitState().failedAttempts).toBe(5);

    recordSuccessfulAttempt();
    const state = getRateLimitState();
    expect(state.failedAttempts).toBe(0);
    expect(state.lockedUntil).toBeNull();
    expect(getRemainingLockoutMs()).toBe(0);
  });

  it('getRemainingLockoutMs returns 0 after expiry without clearing state', () => {
    const now = 4_000_000;
    for (let i = 0; i < 4; i++) recordFailedAttempt(now);
    expect(getRemainingLockoutMs(now + BASE_DELAY_MS + 1)).toBe(0);
    // Counter still retained; lockedUntil still non-null.
    expect(getRateLimitState().failedAttempts).toBe(4);
    expect(getRateLimitState().lockedUntil).not.toBeNull();
  });

  it('malformed sessionStorage data falls back to default state', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not-json');
    expect(getRateLimitState()).toEqual({ failedAttempts: 0, lockedUntil: null });

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ wrong: 'shape' }));
    expect(getRateLimitState()).toEqual({ failedAttempts: 0, lockedUntil: null });
  });

  it('delayForAttempt returns documented values', () => {
    expect(delayForAttempt(1)).toBe(0);
    expect(delayForAttempt(3)).toBe(0);
    expect(delayForAttempt(4)).toBe(2000);
    expect(delayForAttempt(5)).toBe(4000);
    expect(delayForAttempt(6)).toBe(8000);
    expect(delayForAttempt(7)).toBe(16_000);
    expect(delayForAttempt(8)).toBe(32_000);
    expect(delayForAttempt(9)).toBe(60_000);
    expect(delayForAttempt(100)).toBe(60_000);
  });
});
