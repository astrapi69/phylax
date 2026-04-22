import { useCallback, useState } from 'react';
import {
  generateSalt,
  deriveKeyFromPassword,
  unlockWithKey,
  encryptWithStoredKey,
  lock,
} from '../../crypto';
import { db } from '../../db/schema';
import { writeMeta, metaExists, VERIFICATION_TOKEN } from '../../db/meta';
import { encodeMetaPayload, DEFAULT_SETTINGS } from '../../db/settings';
import { recordSuccessfulAttempt } from '../unlock/rateLimit';

export type SetupStatus = 'idle' | 'deriving' | 'done' | 'error';

export type SetupError = { kind: 'meta-write-failed' } | { kind: 'vault-already-exists' };

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

    // Defensive belt-and-suspenders check. SetupFlowGuard already redirects
    // direct-link visits to /unlock when meta exists (TD-05); this closes
    // the millisecond-window race where a parallel tab created a vault
    // between guard-mount and submit, and refuses any programmatic bypass
    // (tests, devtools). Keystore stays locked; no meta overwrite.
    if (await metaExists()) {
      console.error('[useSetupVault] runSetup called with existing vault; refusing to overwrite');
      setError({ kind: 'vault-already-exists' });
      setStatus('error');
      return;
    }

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

    // Defensive: clear any stale unlock rate-limit state a prior tab
    // session may have left behind. Fresh vault should never inherit a
    // lockout.
    recordSuccessfulAttempt();

    setStatus('done');
  }, []);

  return { status, error, runSetup };
}
