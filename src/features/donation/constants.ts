/**
 * Single source of truth for the donation-integration series (S-01/02/03).
 *
 * Changing donation channels is a docs-only edit to DONATE.md in the
 * repo root; no code change required. Changing cadence or cooldowns
 * means editing this file.
 */

export const DONATION_URL = 'https://github.com/astrapi69/phylax/blob/main/DONATE.md';

/** Cooldown (days) applied after the user dismisses the reminder. */
export const REMINDER_COOLDOWN_DAYS_DISMISSED = 90;

/** Cooldown (days) applied after the user follows the donation link. */
export const REMINDER_COOLDOWN_DAYS_DONATED = 180;

/**
 * The reminder banner (S-03) requires the profile's first ProfileVersion
 * to be at least this many days old. Prevents the banner from appearing
 * before the user has had time to form an opinion of the app.
 */
export const PROFILE_AGE_THRESHOLD_DAYS = 90;

/** localStorage key holding the JSON-encoded DonationState. */
export const STORAGE_KEY = 'phylax-donation-state';
