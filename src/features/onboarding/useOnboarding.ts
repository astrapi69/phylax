import { useState, useCallback } from 'react';
import {
  generateSalt,
  deriveKeyFromPassword,
  unlockWithKey,
  encryptWithStoredKey,
  lock,
} from '../../crypto';
import { db } from '../../db/schema';
import { writeMeta, VERIFICATION_TOKEN } from '../../db/meta';
import { validatePassword, estimateStrength, type PasswordStrength } from './passwordValidation';

export type OnboardingState = 'setup' | 'confirm' | 'deriving' | 'done';

export interface OnboardingHook {
  state: OnboardingState;
  password: string;
  confirmPassword: string;
  strength: PasswordStrength;
  passwordError: string | undefined;
  confirmError: string | undefined;
  acknowledged: boolean;
  submitEnabled: boolean;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setAcknowledged: (value: boolean) => void;
  submit: () => Promise<void>;
}

/**
 * Hook that orchestrates the master password onboarding flow.
 *
 * State machine: setup -> confirm -> deriving -> done
 *
 * On successful submit:
 * 1. Generate salt
 * 2. Derive key from password + salt
 * 3. Unlock keyStore with the derived key
 * 4. Encrypt verification token and write meta row (in a transaction)
 * 5. If meta write fails, lock keyStore and re-throw
 *
 * @param onComplete - called when onboarding finishes successfully
 */
export function useOnboarding(onComplete: () => void): OnboardingHook {
  const [state, setState] = useState<OnboardingState>('setup');
  const [password, setPasswordRaw] = useState('');
  const [confirmPassword, setConfirmPasswordRaw] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);

  const validation = validatePassword(password);
  const strength = estimateStrength(password);
  const passwordError = password.length > 0 ? validation.error : undefined;

  const isInConfirmState = validation.valid;
  const currentState: OnboardingState =
    state === 'deriving' || state === 'done' ? state : isInConfirmState ? 'confirm' : 'setup';

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const submitEnabled =
    currentState === 'confirm' && passwordsMatch && acknowledged && validation.valid;

  const setPassword = useCallback(
    (value: string) => {
      setPasswordRaw(value);
      setConfirmError(undefined);
      if (state !== 'deriving' && state !== 'done') {
        setState('setup');
        setConfirmPasswordRaw('');
      }
    },
    [state],
  );

  const setConfirmPassword = useCallback((value: string) => {
    setConfirmPasswordRaw(value);
    setConfirmError(undefined);
  }, []);

  const submit = useCallback(async () => {
    if (!validation.valid) return;

    if (password !== confirmPassword) {
      setConfirmError('Passworter stimmen nicht uberein.');
      setConfirmPasswordRaw('');
      return;
    }

    setState('deriving');

    const salt = generateSalt();
    const key = await deriveKeyFromPassword(password, salt);
    unlockWithKey(key);

    // Encrypt the verification token BEFORE the Dexie transaction.
    // Dexie transactions only stay alive for synchronous work or Dexie promises.
    // Awaiting crypto.subtle inside a transaction causes PrematureCommitError.
    const encoded = new TextEncoder().encode(VERIFICATION_TOKEN);
    const encrypted = await encryptWithStoredKey(encoded);
    const saltBuffer = new Uint8Array(salt).buffer;
    const payloadBuffer = new Uint8Array(encrypted).buffer;

    try {
      await db.transaction('rw', db.meta, async () => {
        await writeMeta(saltBuffer, payloadBuffer);
      });
    } catch (err) {
      lock();
      setState('setup');
      throw err;
    }

    setState('done');
    onComplete();
  }, [password, confirmPassword, validation.valid, onComplete]);

  return {
    state: currentState,
    password,
    confirmPassword,
    strength,
    passwordError,
    confirmError,
    acknowledged,
    submitEnabled,
    setPassword,
    setConfirmPassword,
    setAcknowledged,
    submit,
  };
}
