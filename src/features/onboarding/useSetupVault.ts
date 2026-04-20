import { useCallback, useState } from 'react';
import {
  generateSalt,
  deriveKeyFromPassword,
  unlockWithKey,
  encryptWithStoredKey,
  lock,
} from '../../crypto';
import { db } from '../../db/schema';
import { writeMeta, VERIFICATION_TOKEN } from '../../db/meta';
import { encodeMetaPayload, DEFAULT_SETTINGS } from '../../db/settings';

export type SetupStatus = 'idle' | 'deriving' | 'done' | 'error';

export type SetupError = { kind: 'meta-write-failed' };

export interface SetupVaultHook {
  status: SetupStatus;
  error: SetupError | undefined;
  runSetup: (password: string) => Promise<void>;
}

/**
 * Hook that derives a master key from the given password, unlocks the
 * in-memory keystore, encrypts the verification token + default
 * settings, and writes the meta row in a Dexie transaction.
 *
 * The meta-payload encryption happens BEFORE opening the Dexie
 * transaction because `crypto.subtle` awaits cause PrematureCommitError
 * if awaited inside a transaction scope.
 *
 * On meta-write failure the keystore is locked again so the UI stays
 * in a consistent "no vault yet" state.
 */
export function useSetupVault(): SetupVaultHook {
  const [status, setStatus] = useState<SetupStatus>('idle');
  const [error, setError] = useState<SetupError | undefined>(undefined);

  const runSetup = useCallback(async (password: string) => {
    setStatus('deriving');
    setError(undefined);

    const salt = generateSalt();
    const key = await deriveKeyFromPassword(password, salt);
    unlockWithKey(key);

    const payloadBytes = encodeMetaPayload({
      verificationToken: VERIFICATION_TOKEN,
      settings: DEFAULT_SETTINGS,
    });
    const encrypted = await encryptWithStoredKey(payloadBytes);
    const saltBuffer = new Uint8Array(salt).buffer;
    const payloadBuffer = new Uint8Array(encrypted).buffer;

    try {
      await db.transaction('rw', db.meta, async () => {
        await writeMeta(saltBuffer, payloadBuffer);
      });
    } catch (err) {
      lock();
      setError({ kind: 'meta-write-failed' });
      setStatus('error');
      console.error('[useSetupVault] meta write failed', err);
      return;
    }

    setStatus('done');
  }, []);

  return { status, error, runSetup };
}
