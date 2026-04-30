import { useCallback, useState } from 'react';
import { decrypt, deriveKeyFromPassword, getLockState } from '../../crypto';
import { readMeta } from '../../db/meta';
import { reencryptVault } from '../../db/reencrypt';
import { pauseAutoLock } from '../auto-lock/pauseStore';
import { validatePassword } from '../onboarding/passwordValidation';

/**
 * Submit-gate error from the change-password form. The UI maps each
 * kind to a localized message via i18next.
 */
export type ChangePasswordError =
  | { kind: 'wrong-current' }
  | { kind: 'weak-new'; reason: 'empty' | 'too-short'; min?: number; length?: number }
  | { kind: 'mismatch' }
  | { kind: 'same-as-current' }
  | { kind: 'no-meta' }
  | { kind: 'locked' }
  | { kind: 'reencrypt-failed'; detail: string }
  /**
   * Phase 2 committed but Phase 3 (`replaceStoredKey`) threw. The
   * vault is on disk under newKey but the keyStore singleton still
   * references oldKey. User reload + unlock with new password
   * recovers (ADR-0018 Section 6).
   */
  | { kind: 'partial-failure'; detail: string };

export type ChangePasswordStatus =
  | { kind: 'idle' }
  | { kind: 'verifying' }
  | { kind: 'reencrypting' }
  | { kind: 'done' }
  | { kind: 'error'; error: ChangePasswordError };

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordHook {
  status: ChangePasswordStatus;
  /**
   * Run the full change-password flow:
   *   1. Submit-gate validation (length, mismatch, same-as-current).
   *   2. Sudo-pattern verification: re-derive key from currentPassword +
   *      stored salt, decrypt meta.payload to confirm the user knows
   *      the current password right now (ADR-0018 Section 1).
   *   3. Pause auto-lock for the duration.
   *   4. Re-encrypt every encrypted row + meta.payload from oldKey to
   *      newKey via the three-phase reencryptVault primitive.
   *   5. Release pause; return idle.
   */
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  /** Reset to idle. Use after surfacing a done or error state to the user. */
  reset: () => void;
}

function validateInputs(input: ChangePasswordInput): ChangePasswordError | null {
  const newCheck = validatePassword(input.newPassword);
  if (!newCheck.valid) {
    if (newCheck.error.kind === 'empty') {
      return { kind: 'weak-new', reason: 'empty' };
    }
    return {
      kind: 'weak-new',
      reason: 'too-short',
      min: newCheck.error.min,
      length: newCheck.error.length,
    };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { kind: 'mismatch' };
  }
  if (input.newPassword === input.currentPassword) {
    return { kind: 'same-as-current' };
  }
  return null;
}

/**
 * Re-derive a key from the typed currentPassword and decrypt the meta
 * verification payload to confirm the user knows the current password.
 * Returns the freshly-derived oldKey on success; throws on wrong
 * password (caller maps to ChangePasswordError).
 */
async function verifyCurrentPassword(currentPassword: string): Promise<CryptoKey> {
  const meta = await readMeta();
  if (!meta) throw new Error('no-meta');

  const candidate = await deriveKeyFromPassword(currentPassword, new Uint8Array(meta.salt));
  // Will throw on wrong key (AES-GCM auth tag mismatch).
  await decrypt(candidate, new Uint8Array(meta.payload));
  return candidate;
}

export function useChangeMasterPassword(): ChangePasswordHook {
  const [status, setStatus] = useState<ChangePasswordStatus>({ kind: 'idle' });

  const reset = useCallback((): void => {
    setStatus({ kind: 'idle' });
  }, []);

  const changePassword = useCallback(async (input: ChangePasswordInput): Promise<void> => {
    if (getLockState() !== 'unlocked') {
      setStatus({ kind: 'error', error: { kind: 'locked' } });
      return;
    }

    const inputError = validateInputs(input);
    if (inputError) {
      setStatus({ kind: 'error', error: inputError });
      return;
    }

    setStatus({ kind: 'verifying' });

    let oldKey: CryptoKey;
    try {
      oldKey = await verifyCurrentPassword(input.currentPassword);
    } catch (err) {
      if (err instanceof Error && err.message === 'no-meta') {
        setStatus({ kind: 'error', error: { kind: 'no-meta' } });
        return;
      }
      setStatus({ kind: 'error', error: { kind: 'wrong-current' } });
      return;
    }

    const meta = await readMeta();
    if (!meta) {
      setStatus({ kind: 'error', error: { kind: 'no-meta' } });
      return;
    }
    const newKey = await deriveKeyFromPassword(input.newPassword, new Uint8Array(meta.salt));

    setStatus({ kind: 'reencrypting' });
    const releasePause = pauseAutoLock();
    try {
      await reencryptVault(oldKey, newKey);
      setStatus({ kind: 'done' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      // The ADR-0018 partial-failure path: Phase 2 committed but
      // Phase 3 (replaceStoredKey) threw. Caller cannot distinguish
      // here without inspecting on-disk state, but we surface a
      // distinct error kind when the message identifies the swap-
      // step throw. Default to reencrypt-failed otherwise.
      const isSwapFailure =
        err instanceof Error && /Cannot replace key|store is locked/i.test(err.message);
      setStatus({
        kind: 'error',
        error: isSwapFailure
          ? { kind: 'partial-failure', detail }
          : { kind: 'reencrypt-failed', detail },
      });
    } finally {
      releasePause();
    }
  }, []);

  return { status, changePassword, reset };
}
