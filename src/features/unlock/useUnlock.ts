import { useState, useCallback } from 'react';
import { deriveKeyFromPassword, unlockWithKey, decryptWithStoredKey, lock } from '../../crypto';
import { readMeta, VERIFICATION_TOKEN } from '../../db/meta';
import { decodeMetaPayload } from '../../db/settings';

export type UnlockState = 'idle' | 'entering' | 'deriving' | 'done' | 'error';

export interface UnlockHook {
  state: UnlockState;
  password: string;
  error: string | undefined;
  failedAttempts: number;
  submitEnabled: boolean;
  setPassword: (value: string) => void;
  submit: () => Promise<void>;
}

/**
 * Hook that orchestrates the returning-user unlock flow.
 *
 * State machine: idle -> entering -> deriving -> done | error
 *
 * On submit:
 * 1. Read meta row (throw if missing)
 * 2. Derive key from password + stored salt
 * 3. Unlock keyStore with derived key
 * 4. Decrypt verification token from meta payload
 * 5. If token matches VERIFICATION_TOKEN: stay unlocked, done
 * 6. If mismatch or decrypt throws: lock keyStore, show error
 *
 * @param onUnlocked - called when unlock succeeds
 */
export function useUnlock(onUnlocked: () => void): UnlockHook {
  const [state, setState] = useState<UnlockState>('idle');
  const [password, setPasswordRaw] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const submitEnabled = password.length > 0 && state !== 'deriving' && state !== 'done';

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

    setState('deriving');

    const meta = await readMeta();
    if (!meta) {
      throw new Error('No meta row found. Onboarding was never completed.');
    }

    const salt = new Uint8Array(meta.salt);
    const key = await deriveKeyFromPassword(password, salt);
    unlockWithKey(key);

    try {
      const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
      const metaPayload = decodeMetaPayload(decrypted);

      if (metaPayload.verificationToken !== VERIFICATION_TOKEN) {
        lock();
        setFailedAttempts((prev) => prev + 1);
        setError('Falsches Passwort.');
        setState('error');
        return;
      }
    } catch {
      lock();
      setFailedAttempts((prev) => prev + 1);
      setError('Falsches Passwort.');
      setState('error');
      return;
    }

    setState('done');
    onUnlocked();
  }, [password, onUnlocked]);

  return {
    state,
    password,
    error,
    failedAttempts,
    submitEnabled,
    setPassword,
    submit,
  };
}
