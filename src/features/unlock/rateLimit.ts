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
 * Scope: separate counters per logical operation. Default export binds
 * the unlock-flow counter. Backup-import creates its own limiter via
 * `createRateLimiter(BACKUP_IMPORT_STORAGE_KEY)` so that typos on one
 * flow do not affect the other. Multi-profile (Phase 8) may want
 * per-vault scoping. TODO [M-xx]: revisit storage-key shape when
 * multi-profile lands.
 */

export const FREE_ATTEMPTS = 3;
export const BASE_DELAY_MS = 2000;
export const MAX_DELAY_MS = 60_000;

/** Default storage key used by the unlock flow. */
export const STORAGE_KEY = 'phylax-unlock-rate-limit';

/** Storage key used by the backup-import flow. */
export const BACKUP_IMPORT_STORAGE_KEY = 'phylax-backup-import-rate-limit';

export interface RateLimitState {
  failedAttempts: number;
  /** Epoch ms when lockout expires. null if not locked. */
  lockedUntil: number | null;
}

export interface RateLimiter {
  getRateLimitState: () => RateLimitState;
  recordFailedAttempt: (now?: number) => RateLimitState;
  recordSuccessfulAttempt: () => void;
  getRemainingLockoutMs: (now?: number) => number;
}

const DEFAULT_STATE: RateLimitState = { failedAttempts: 0, lockedUntil: null };

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

/**
 * Factory for rate-limiter instances scoped to a sessionStorage key.
 * Each logical flow (unlock, backup-import) constructs its own limiter
 * so that typos on one flow do not lock out the other.
 *
 * The `now` parameter on `recordFailedAttempt` and `getRemainingLockoutMs`
 * is intended for deterministic testing. Production code should omit it.
 */
export function createRateLimiter(storageKey: string): RateLimiter {
  function readStorage(): RateLimitState {
    if (typeof sessionStorage === 'undefined') return { ...DEFAULT_STATE };
    try {
      const raw = sessionStorage.getItem(storageKey);
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
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Quota exceeded or private mode restrictions; silently skip.
      // Rate-limiting is a convenience, not a security guarantee.
    }
  }

  function clearStorage(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore.
    }
  }

  return {
    getRateLimitState: () => readStorage(),
    recordFailedAttempt(now: number = Date.now()): RateLimitState {
      const current = readStorage();
      const failedAttempts = current.failedAttempts + 1;
      const delay = delayForAttempt(failedAttempts);
      const lockedUntil = delay > 0 ? now + delay : null;
      const next: RateLimitState = { failedAttempts, lockedUntil };
      writeStorage(next);
      return next;
    },
    recordSuccessfulAttempt: () => clearStorage(),
    getRemainingLockoutMs(now: number = Date.now()): number {
      const { lockedUntil } = readStorage();
      if (lockedUntil === null) return 0;
      const remaining = lockedUntil - now;
      return remaining > 0 ? remaining : 0;
    },
  };
}

/**
 * Default unlock-flow limiter. Existing callers (useUnlock,
 * useSetupVault) import these module-level functions directly.
 */
const unlockLimiter = createRateLimiter(STORAGE_KEY);

export const getRateLimitState = unlockLimiter.getRateLimitState;
export const recordFailedAttempt = unlockLimiter.recordFailedAttempt;
export const recordSuccessfulAttempt = unlockLimiter.recordSuccessfulAttempt;
export const getRemainingLockoutMs = unlockLimiter.getRemainingLockoutMs;
