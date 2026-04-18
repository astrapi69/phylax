import { STORAGE_KEY } from './constants';

/**
 * State shape for the donation-integration series (S-01/02/03).
 *
 * Stored unencrypted in localStorage: the fields are not sensitive
 * (boolean flag + which branch of a three-way choice was last taken +
 * ISO date). Putting this in IndexedDB would force a decrypt on app
 * start for no security benefit. Consistent with existing theme and
 * disclaimer storage patterns.
 */
export interface DonationState {
  /**
   * True once the user has seen the one-time onboarding hint (S-02).
   * Set by both the "Projekt unterstuetzen" action and the "Verstanden"
   * dismissal so the hint never reappears after the first acknowledgment.
   */
  onboardingSeen: boolean;
  /**
   * Last action the user took on the S-03 reminder banner:
   * - 'donated'  -> cooldown 180 days
   * - 'dismissed' -> cooldown 90 days
   * - null       -> no banner interaction yet
   */
  lastReminderAction: 'donated' | 'dismissed' | null;
  /** ISO date (YYYY-MM-DD) of the last reminder interaction, or null. */
  lastReminderDate: string | null;
}

export const DEFAULT_DONATION_STATE: DonationState = {
  onboardingSeen: false,
  lastReminderAction: null,
  lastReminderDate: null,
};

/**
 * Read the stored donation state, merging with defaults so missing fields
 * (older installs, partial writes) never produce `undefined`. Safe on
 * browsers with disabled storage or corrupted JSON: falls through to
 * defaults.
 */
export function readDonationState(): DonationState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DONATION_STATE };
    const parsed = JSON.parse(raw) as unknown;
    return normalize(parsed);
  } catch {
    return { ...DEFAULT_DONATION_STATE };
  }
}

/**
 * Merge `patch` into the current stored state and persist. Returns the
 * resulting full state so callers can act on the next-state value
 * without a separate read. Silently swallows storage errors.
 */
export function writeDonationState(patch: Partial<DonationState>): DonationState {
  const current = readDonationState();
  const next: DonationState = { ...current, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / quota exceeded. In-memory caller still sees
    // the merged state via the returned value.
  }
  return next;
}

/** Clear the stored donation state. Safe on disabled storage. */
export function resetDonationState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fall through
  }
}

function normalize(raw: unknown): DonationState {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_DONATION_STATE };
  }
  const obj = raw as Record<string, unknown>;
  const onboardingSeen = obj['onboardingSeen'] === true;
  const action = obj['lastReminderAction'];
  const lastReminderAction: DonationState['lastReminderAction'] =
    action === 'donated' || action === 'dismissed' ? action : null;
  const date = obj['lastReminderDate'];
  const lastReminderDate = typeof date === 'string' && date.length > 0 ? date : null;
  return { onboardingSeen, lastReminderAction, lastReminderDate };
}
