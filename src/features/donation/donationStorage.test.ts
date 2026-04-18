import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEY } from './constants';
import {
  DEFAULT_DONATION_STATE,
  readDonationState,
  writeDonationState,
  resetDonationState,
} from './donationStorage';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('donationStorage', () => {
  it('returns the default state when nothing is stored', () => {
    expect(readDonationState()).toEqual(DEFAULT_DONATION_STATE);
  });

  it('reads a stored state verbatim', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        onboardingSeen: true,
        lastReminderAction: 'donated',
        lastReminderDate: '2026-04-18',
      }),
    );
    expect(readDonationState()).toEqual({
      onboardingSeen: true,
      lastReminderAction: 'donated',
      lastReminderDate: '2026-04-18',
    });
  });

  it('merges a partial patch into the current state on write', () => {
    writeDonationState({ onboardingSeen: true });
    writeDonationState({ lastReminderAction: 'dismissed', lastReminderDate: '2026-04-18' });

    expect(readDonationState()).toEqual({
      onboardingSeen: true,
      lastReminderAction: 'dismissed',
      lastReminderDate: '2026-04-18',
    });
  });

  it('returns the next-state value from writeDonationState', () => {
    const next = writeDonationState({ onboardingSeen: true });
    expect(next.onboardingSeen).toBe(true);
    expect(next.lastReminderAction).toBeNull();
  });

  it('falls back to defaults when the stored JSON is malformed', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(readDonationState()).toEqual(DEFAULT_DONATION_STATE);
  });

  it('coerces unknown action values to null', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        onboardingSeen: true,
        lastReminderAction: 'nonsense',
        lastReminderDate: '2026-04-18',
      }),
    );
    expect(readDonationState().lastReminderAction).toBeNull();
  });

  it('falls back to defaults when localStorage.getItem throws (private browsing)', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readDonationState()).toEqual(DEFAULT_DONATION_STATE);
  });

  it('swallows localStorage.setItem errors but still returns the merged state', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const next = writeDonationState({ onboardingSeen: true });
    expect(next.onboardingSeen).toBe(true);
  });

  it('resetDonationState clears the stored entry', () => {
    writeDonationState({ onboardingSeen: true });
    resetDonationState();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(readDonationState()).toEqual(DEFAULT_DONATION_STATE);
  });
});
