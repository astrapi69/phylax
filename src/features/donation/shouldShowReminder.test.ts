import { describe, it, expect } from 'vitest';
import type { DonationState } from './donationStorage';
import { DEFAULT_DONATION_STATE } from './donationStorage';
import { shouldShowReminder } from './shouldShowReminder';

const NOW = new Date('2026-04-30T12:00:00Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * ONE_DAY_MS);
}

function isoDaysAgo(n: number): string {
  return daysAgo(n).toISOString().slice(0, 10);
}

function seen(): DonationState {
  return { ...DEFAULT_DONATION_STATE, onboardingSeen: true };
}

describe('shouldShowReminder', () => {
  it('returns false when there is no first-version date (no active use)', () => {
    expect(shouldShowReminder(null, seen(), NOW)).toBe(false);
  });

  it('returns false when the onboarding hint has not been acknowledged (gate)', () => {
    // onboardingSeen = false on DEFAULT_DONATION_STATE
    expect(shouldShowReminder(daysAgo(200), DEFAULT_DONATION_STATE, NOW)).toBe(false);
  });

  it('returns false when profile age is less than 90 days', () => {
    expect(shouldShowReminder(daysAgo(89), seen(), NOW)).toBe(false);
  });

  it('returns true when profile is 90+ days old and there is no prior reminder', () => {
    expect(shouldShowReminder(daysAgo(90), seen(), NOW)).toBe(true);
    expect(shouldShowReminder(daysAgo(120), seen(), NOW)).toBe(true);
  });

  it('returns false when a dismissed reminder is less than 90 days old', () => {
    const state: DonationState = {
      ...seen(),
      lastReminderAction: 'dismissed',
      lastReminderDate: isoDaysAgo(30),
    };
    expect(shouldShowReminder(daysAgo(200), state, NOW)).toBe(false);
  });

  it('returns true when a dismissed reminder is 90+ days old', () => {
    const state: DonationState = {
      ...seen(),
      lastReminderAction: 'dismissed',
      lastReminderDate: isoDaysAgo(90),
    };
    expect(shouldShowReminder(daysAgo(200), state, NOW)).toBe(true);
  });

  it('returns false when a donated reminder is less than 180 days old', () => {
    const state: DonationState = {
      ...seen(),
      lastReminderAction: 'donated',
      lastReminderDate: isoDaysAgo(100),
    };
    expect(shouldShowReminder(daysAgo(200), state, NOW)).toBe(false);
  });

  it('returns true when a donated reminder is 180+ days old', () => {
    const state: DonationState = {
      ...seen(),
      lastReminderAction: 'donated',
      lastReminderDate: isoDaysAgo(180),
    };
    expect(shouldShowReminder(daysAgo(400), state, NOW)).toBe(true);
  });
});
