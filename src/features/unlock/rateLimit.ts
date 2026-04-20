/**
 * Unlock rate-limiter. Slows down typo-prone users after repeated
 * wrong-password attempts. Persisted in sessionStorage so a reload
 * during an active lockout keeps the countdown running; closing the
 * tab resets state.
 *
 * Threat model: this layer exists to make casual typo sequences less
 * annoying and to discourage manual brute-force via the UI. It is NOT
 * a defense against motivated attackers, who bypass the UI entirely by
 * running PBKDF2 directly against the ciphertext. Client-clock based
 * (`Date.now()`); a user who manipulates their own clock can shortcut
 * the lockout, which is outside the threat model.
 *
 * Scope: single global counter per tab. Multi-profile (Phase 8) may
 * want per-vault scoping. TODO [M-xx]: revisit storage key + state
 * shape when multi-profile lands.
 */

export const FREE_ATTEMPTS = 3;
export const BASE_DELAY_MS = 2000;
export const MAX_DELAY_MS = 60_000;
export const STORAGE_KEY = 'phylax-unlock-rate-limit';

export interface RateLimitState {
  failedAttempts: number;
  /** Epoch ms when lockout expires. null if not locked. */
  lockedUntil: number | null;
}

const DEFAULT_STATE: RateLimitState = { failedAttempts: 0, lockedUntil: null };

function readStorage(): RateLimitState {
  if (typeof sessionStorage === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'failedAttempts' in parsed &&
      typeof (parsed as RateLimitState).failedAttempts === 'number'
    ) {
      const p = parsed as RateLimitState;
      return {
        failedAttempts: p.failedAttempts,
        lockedUntil: typeof p.lockedUntil === 'number' ? p.lockedUntil : null,
      };
    }
    return { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeStorage(state: RateLimitState): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or private mode restrictions; silently skip.
    // Rate-limiting is a convenience, not a security guarantee.
  }
}

function clearStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Compute the lockout delay for a given failed-attempt count.
 * Attempts 1-3: 0ms. Attempt 4: 2s. Attempt 5: 4s. Doubles per
 * attempt up to 60s cap.
 */
export function delayForAttempt(attempt: number): number {
  if (attempt <= FREE_ATTEMPTS) return 0;
  const exponent = attempt - FREE_ATTEMPTS;
  return Math.min(BASE_DELAY_MS * 2 ** (exponent - 1), MAX_DELAY_MS);
}

/** Read the current rate-limit state from sessionStorage. */
export function getRateLimitState(): RateLimitState {
  return readStorage();
}

/**
 * Record a failed unlock attempt. Increments the counter and, if the
 * attempt crosses the free-attempt threshold, sets `lockedUntil`
 * relative to the time of this failing attempt.
 *
 * The `now` parameter is intended for deterministic testing.
 * Production code should omit it.
 */
export function recordFailedAttempt(now: number = Date.now()): RateLimitState {
  const current = readStorage();
  const failedAttempts = current.failedAttempts + 1;
  const delay = delayForAttempt(failedAttempts);
  const lockedUntil = delay > 0 ? now + delay : null;
  const next: RateLimitState = { failedAttempts, lockedUntil };
  writeStorage(next);
  return next;
}

/**
 * Clear all rate-limit state. Called on successful unlock and on
 * successful setup (defensive - fresh vault should never inherit a
 * stale lockout from a prior tab session).
 */
export function recordSuccessfulAttempt(): void {
  clearStorage();
}

/**
 * Remaining lockout in ms, or 0 if not currently locked. Returns 0
 * for expired lockouts without clearing them; the counter itself
 * stays until the next recordFailedAttempt or recordSuccessfulAttempt
 * call rewrites it.
 *
 * The `now` parameter is intended for deterministic testing.
 * Production code should omit it.
 */
export function getRemainingLockoutMs(now: number = Date.now()): number {
  const { lockedUntil } = readStorage();
  if (lockedUntil === null) return 0;
  const remaining = lockedUntil - now;
  return remaining > 0 ? remaining : 0;
}
