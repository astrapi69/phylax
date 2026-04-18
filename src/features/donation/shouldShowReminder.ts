import type { DonationState } from './donationStorage';
import {
  PROFILE_AGE_THRESHOLD_DAYS,
  REMINDER_COOLDOWN_DAYS_DISMISSED,
  REMINDER_COOLDOWN_DAYS_DONATED,
} from './constants';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure gate for the S-03 reminder banner.
 *
 * Returns true only when ALL of the following hold:
 *  - The user has a first ProfileVersion entry (proxy for active use).
 *  - The onboarding hint (S-02) was already acknowledged; the two
 *    banners are mutually exclusive by this onboarding gate.
 *  - The first ProfileVersion is at least PROFILE_AGE_THRESHOLD_DAYS old.
 *  - No reminder was shown within the configured cooldown: 180 days
 *    after a 'donated' action, 90 days after a 'dismissed' action.
 *
 * Each condition is tested independently in shouldShowReminder.test.ts
 * so regressions surface exactly where they are introduced.
 */
export function shouldShowReminder(
  firstVersionDate: Date | null,
  state: DonationState,
  now: Date = new Date(),
): boolean {
  if (!firstVersionDate) return false;
  if (!state.onboardingSeen) return false;

  if (daysBetween(firstVersionDate, now) < PROFILE_AGE_THRESHOLD_DAYS) return false;

  if (state.lastReminderDate) {
    const cooldown =
      state.lastReminderAction === 'donated'
        ? REMINDER_COOLDOWN_DAYS_DONATED
        : REMINDER_COOLDOWN_DAYS_DISMISSED;
    const daysSinceLastReminder = daysBetween(new Date(state.lastReminderDate), now);
    if (daysSinceLastReminder < cooldown) return false;
  }

  return true;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / ONE_DAY_MS);
}
