/**
 * Persistence for the AI activation disclaimer acknowledgment flag.
 *
 * Stored in localStorage (unencrypted) because a boolean "user saw the
 * disclaimer" flag is not sensitive; it only controls whether the
 * disclaimer modal is shown again on next activation.
 */

export const DISCLAIMER_STORAGE_KEY = 'phylax-ai-disclaimer-accepted';

/**
 * True when the user has previously accepted the AI disclaimer.
 * Safe on browsers with localStorage disabled (returns false).
 */
export function isDisclaimerAccepted(): boolean {
  try {
    return window.localStorage.getItem(DISCLAIMER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Mark the disclaimer as accepted. Silently ignores storage errors. */
export function setDisclaimerAccepted(): void {
  try {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
  } catch {
    // private browsing, quota, etc. fall through silently.
  }
}

/**
 * Clear the disclaimer-accepted flag. Used as part of the one-click
 * disable flow so re-enabling re-shows the disclaimer.
 */
export function clearDisclaimerAccepted(): void {
  try {
    window.localStorage.removeItem(DISCLAIMER_STORAGE_KEY);
  } catch {
    // fall through silently.
  }
}
