import { useState, useCallback, useEffect } from 'react';
import { deriveKeyFromPassword, unlockWithKey, decryptWithStoredKey, lock } from '../../crypto';
import { readMeta, VERIFICATION_TOKEN } from '../../db/meta';
import { decodeMetaPayload } from '../../db/settings';
import {
  getRateLimitState,
  getRemainingLockoutMs,
  recordFailedAttempt,
  recordSuccessfulAttempt,
} from './rateLimit';

export type UnlockState = 'idle' | 'entering' | 'deriving' | 'done' | 'error';

/**
 * Discriminated unlock failure. The UI layer resolves each variant to
 * a user-facing string via i18next so the hook stays free of
 * translation concerns.
 */
export type UnlockError = 'wrong-password' | 'no-meta';

export interface UnlockHook {
  state: UnlockState;
  password: string;
  error: UnlockError | undefined;
  failedAttempts: number;
  /** Remaining lockout in ms. 0 when not locked. */
  remainingLockoutMs: number;
  submitEnabled: boolean;
  setPassword: (value: string) => void;
  submit: () => Promise<void>;
}

const TICK_INTERVAL_MS = 250;

/**
 * Hook that orchestrates the returning-user unlock flow.
 *
 * State machine: idle -> entering -> deriving -> done | error
 *
 * Rate-limiting: after 3 failed attempts the hook blocks further
 * submissions until the exponential-backoff lockout expires (2s, 4s,
 * 8s, ..., capped at 60s). Lockout state is persisted via
 * `rateLimit.ts` and survives page reload within the same tab.
 *
 * On submit:
 * 1. If lockout is active, abort silently.
 * 2. Read meta row. If missing, surface `'no-meta'` error.
 * 3. Derive key from password + stored salt.
 * 4. Unlock keyStore with derived key.
 * 5. Decrypt verification token from meta payload.
 * 6. If token matches VERIFICATION_TOKEN: clear rate-limit, mark done.
 * 7. On mismatch or decrypt failure: lock keyStore, record failed
 *    attempt, surface `'wrong-password'`.
 *
 * @param onUnlocked - called when unlock succeeds
 */
export function useUnlock(onUnlocked: () => void): UnlockHook {
  const initialRateState = getRateLimitState();
  const [state, setState] = useState<UnlockState>('idle');
  const [password, setPasswordRaw] = useState('');
  const [error, setError] = useState<UnlockError | undefined>(undefined);
  const [failedAttempts, setFailedAttempts] = useState(initialRateState.failedAttempts);
  const [remainingLockoutMs, setRemainingLockoutMs] = useState(() => getRemainingLockoutMs());

  useEffect(() => {
    if (remainingLockoutMs <= 0) return undefined;
    const id = setInterval(() => {
      const next = getRemainingLockoutMs();
      setRemainingLockoutMs(next);
      if (next <= 0) clearInterval(id);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [remainingLockoutMs]);

  const isLocked = remainingLockoutMs > 0;
  const submitEnabled =
    password.length > 0 && state !== 'deriving' && state !== 'done' && !isLocked;

  const setPassword = useCallback(
    (value: string) => {
      setPasswordRaw(value);
      if (error) {
        setError(undefined);
        setState('entering');
      } else if (value.length > 0) {
        setState('entering');
      }
    },
    [error],
  );

  const submit = useCallback(async () => {
    if (password.length === 0) return;
    if (getRemainingLockoutMs() > 0) return;

    setState('deriving');

    const meta = await readMeta();
    if (!meta) {
      setError('no-meta');
      setState('error');
      return;
    }

    const salt = new Uint8Array(meta.salt);
    const key = await deriveKeyFromPassword(password, salt);
    unlockWithKey(key);

    try {
      const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
      const metaPayload = decodeMetaPayload(decrypted);

      if (metaPayload.verificationToken !== VERIFICATION_TOKEN) {
        lock();
        const next = recordFailedAttempt();
        setFailedAttempts(next.failedAttempts);
        setRemainingLockoutMs(getRemainingLockoutMs());
        setError('wrong-password');
        setState('error');
        return;
      }
    } catch {
      lock();
      const next = recordFailedAttempt();
      setFailedAttempts(next.failedAttempts);
      setRemainingLockoutMs(getRemainingLockoutMs());
      setError('wrong-password');
      setState('error');
      return;
    }

    recordSuccessfulAttempt();
    setFailedAttempts(0);
    setRemainingLockoutMs(0);
    setState('done');
    onUnlocked();
  }, [password, onUnlocked]);

  return {
    state,
    password,
    error,
    failedAttempts,
    remainingLockoutMs,
    submitEnabled,
    setPassword,
    submit,
  };
}
