import { useCallback, useState } from 'react';
import { db } from '../../db/schema';

/**
 * Storage key prefix matching profile-scoped UI state. Soft reset
 * wipes only these keys: the profile they reference will not exist
 * after the wipe, so leaving the entry behind would point at a
 * dangling profileId. User-preference keys (theme, language, sort
 * order, etc.) and security keys (rate limiters) are NOT wiped -
 * the user keeps their preferences and the rate-limiter budget
 * remains in effect against the same master password.
 *
 * Today only `phylax.persistence.dismissed.{profileId}` matches
 * this pattern (PersistentStorageBanner). New profile-scoped keys
 * MUST follow the same prefix to participate in soft reset.
 */
const PROFILE_SCOPED_STORAGE_KEY_PATTERN = /^phylax\.persistence\./;

export type SoftResetStep = 'idle' | 'clearing-data' | 'clearing-storage' | 'done';

export interface SoftResetResult {
  /** True if every wipe step completed without raising. */
  fullySucceeded: boolean;
  /** Per-step error log; empty when `fullySucceeded` is true. */
  errors: SoftResetStepError[];
}

export interface SoftResetStepError {
  step: SoftResetStep;
  message: string;
}

export interface UseSoftResetResult {
  /** Current step in the wipe sequence; `'idle'` until `softReset()` runs. */
  step: SoftResetStep;
  /** `true` while the wipe is in flight. */
  inProgress: boolean;
  /** Latest result, populated after the wipe completes (success or partial). */
  result: SoftResetResult | null;
  /**
   * Run the soft-reset wipe sequence. Best-effort: every step runs
   * even if a prior one threw; per-step errors collected into
   * `result.errors`. The hook does NOT navigate - callers decide
   * the post-reset destination (typically `/profile/create` via
   * React Router) based on `result.fullySucceeded`.
   */
  softReset: () => Promise<void>;
}

/**
 * Soft-reset hook. Wipes profile data only; preserves auth state
 * (master-password salt + verification token + onboarding flag),
 * AI configuration, user preferences, and the in-memory crypto
 * key (the user stays unlocked).
 *
 * Compare to `useResetAllData` (hard reset) which deletes the
 * entire Dexie database, wipes every Phylax-prefixed
 * localStorage / sessionStorage key, clears caches + service
 * worker, and reloads the app to onboarding.
 *
 * Wipe sequence (best-effort, per-step try/catch):
 * 1. Open one Dexie read-write transaction over the ten data
 *    tables and call `Table.clear()` on each. The `meta` table
 *    is NOT in the transaction scope - salt + onboarding flag
 *    + AI config (encrypted in `meta.payload`) all stay intact.
 * 2. Wipe profile-scoped localStorage keys
 *    (`phylax.persistence.*` only). User-preference and
 *    security-rate-limiter keys are kept.
 *
 * The order matters (W4): the localStorage wipe runs AFTER the
 * Dexie transaction commits. If the transaction fails mid-way,
 * Dexie rolls back the data wipe AND localStorage stays
 * consistent for retry. If localStorage wipe step fails after a
 * successful data wipe: minor stale entry, non-blocking; the
 * stale `phylax.persistence.dismissed.*` key references a
 * profile that no longer exists, harmless.
 *
 * Caller is responsible for navigation after the wipe. Typical
 * destination is `/profile/create` so the user lands on the
 * profile-creation form with the master password still set.
 */
export function useSoftReset(): UseSoftResetResult {
  const [step, setStep] = useState<SoftResetStep>('idle');
  const [inProgress, setInProgress] = useState(false);
  const [result, setResult] = useState<SoftResetResult | null>(null);

  const softReset = useCallback(async () => {
    setInProgress(true);
    setResult(null);
    const errors: SoftResetStepError[] = [];

    setStep('clearing-data');
    try {
      await db.transaction(
        'rw',
        [
          db.profiles,
          db.observations,
          db.labReports,
          db.labValues,
          db.supplements,
          db.openPoints,
          db.profileVersions,
          db.documents,
          db.documentBlobs,
          db.timelineEntries,
        ],
        async () => {
          await Promise.all([
            db.profiles.clear(),
            db.observations.clear(),
            db.labReports.clear(),
            db.labValues.clear(),
            db.supplements.clear(),
            db.openPoints.clear(),
            db.profileVersions.clear(),
            db.documents.clear(),
            db.documentBlobs.clear(),
            db.timelineEntries.clear(),
          ]);
        },
      );
    } catch (err) {
      errors.push({ step: 'clearing-data', message: errorMessage(err) });
    }

    setStep('clearing-storage');
    try {
      wipeProfileScopedStorage(window.localStorage);
    } catch (err) {
      errors.push({ step: 'clearing-storage', message: errorMessage(err) });
    }

    const finalResult: SoftResetResult = {
      fullySucceeded: errors.length === 0,
      errors,
    };
    setResult(finalResult);
    setStep('done');
    setInProgress(false);
  }, []);

  return { step, inProgress, result, softReset };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Two-pass enumeration: collect matching keys, then remove. Removal
 * during iteration shifts indices on a live `Storage` object.
 */
function wipeProfileScopedStorage(storage: Storage): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && PROFILE_SCOPED_STORAGE_KEY_PATTERN.test(key)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}
