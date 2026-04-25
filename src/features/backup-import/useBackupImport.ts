import { useCallback, useEffect, useMemo, useState } from 'react';
import { unlockWithKey } from '../../crypto';
import { decryptBackup, type DecryptError } from './decryptBackup';
import { populateVault, type PopulateError } from './populateVault';
import type { ParsedPhylaxFile } from './parseBackupFile';
import { createRateLimiter, BACKUP_IMPORT_STORAGE_KEY } from '../unlock/rateLimit';

export type BackupImportStatus = 'idle' | 'deriving' | 'populating' | 'done' | 'error';

export type BackupImportError =
  | DecryptError
  | PopulateError
  | { kind: 'rate-limited'; remainingMs: number };

const TICK_INTERVAL_MS = 250;

export interface UseBackupImportResult {
  status: BackupImportStatus;
  error: BackupImportError | null;
  remainingLockoutMs: number;
  isLocked: boolean;
  /**
   * Drive the decrypt → populate → unlockWithKey pipeline. Returns
   * `{ ok: true, hasProfile }` on success so the caller can route
   * appropriately, or `{ ok: false }` when the run failed (error +
   * status are populated on the hook state for UI rendering).
   *
   * Both consumers (full-screen `/backup/import/unlock` route and
   * the post-auth Settings section) share this same pipeline,
   * including the rate-limiter (`BACKUP_IMPORT_STORAGE_KEY`) — so
   * brute-force attempts across both surfaces share one lockout
   * budget. Independent limiters would let an attacker double their
   * attempts by alternating surfaces.
   */
  run: (
    parsed: ParsedPhylaxFile,
    password: string,
  ) => Promise<{ ok: true; hasProfile: boolean } | { ok: false }>;
  /** Reset error/status back to idle. Caller calls this on retry. */
  reset: () => void;
  /** Clear error inline (e.g. on input change). */
  clearError: () => void;
}

/**
 * State machine for `.phylax` backup restoration. Drives the
 * decrypt → populate → unlockWithKey sequence, owns the shared
 * rate-limiter budget, and exposes a typed error/status surface
 * for inline rendering.
 *
 * Extracted from `BackupImportUnlockView` so both consumers (the
 * pre-auth full-screen route and the new post-auth Settings section)
 * share identical logic. Both callers translate the same
 * `BackupImportError` union via the same i18n keys, so wrong-password
 * messages, rate-limit countdowns, and schema-version mismatches read
 * identically across surfaces.
 *
 * Navigation is the caller's responsibility — the hook returns
 * `hasProfile` on success so the caller can route to `/profile` vs
 * `/profile/create` (or stay in place, in the Settings case).
 */
export function useBackupImport(): UseBackupImportResult {
  const limiter = useMemo(() => createRateLimiter(BACKUP_IMPORT_STORAGE_KEY), []);

  const [status, setStatus] = useState<BackupImportStatus>('idle');
  const [error, setError] = useState<BackupImportError | null>(null);
  const [remainingLockoutMs, setRemainingLockoutMs] = useState(() =>
    limiter.getRemainingLockoutMs(),
  );

  useEffect(() => {
    if (remainingLockoutMs <= 0) return undefined;
    const id = setInterval(() => {
      const next = limiter.getRemainingLockoutMs();
      setRemainingLockoutMs(next);
      if (next <= 0) clearInterval(id);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [remainingLockoutMs, limiter]);

  const isLocked = remainingLockoutMs > 0;

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const run = useCallback<UseBackupImportResult['run']>(
    async (parsed, password) => {
      if (limiter.getRemainingLockoutMs() > 0) return { ok: false };
      if (password.length === 0) return { ok: false };

      setStatus('deriving');
      setError(null);

      const decryptResult = await decryptBackup(parsed, password);
      if (!decryptResult.ok) {
        if (decryptResult.error.kind === 'wrong-password') {
          const next = limiter.recordFailedAttempt();
          setRemainingLockoutMs(next.lockedUntil !== null ? limiter.getRemainingLockoutMs() : 0);
        }
        setError(decryptResult.error);
        setStatus('error');
        return { ok: false };
      }

      setStatus('populating');

      const populateResult = await populateVault(
        decryptResult.dump,
        decryptResult.key,
        decryptResult.saltBytes,
      );
      if (!populateResult.ok) {
        setError(populateResult.error);
        setStatus('error');
        return { ok: false };
      }

      unlockWithKey(decryptResult.key);
      limiter.recordSuccessfulAttempt();
      setStatus('done');

      const hasProfile = decryptResult.dump.rows.profiles.length > 0;
      return { ok: true, hasProfile };
    },
    [limiter],
  );

  return { status, error, remainingLockoutMs, isLocked, run, reset, clearError };
}
