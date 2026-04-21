import { useCallback, useEffect, useState } from 'react';
import { buildVaultDump } from './buildVaultDump';
import { createBackup } from './createBackup';
import { downloadBackup } from './downloadBackup';
import { formatBackupFilename } from './filenames';

export const MIN_PASSWORD_LENGTH = 12;

export type BackupExportError =
  | { kind: 'password-too-short' }
  | { kind: 'no-profile' }
  | { kind: 'locked' }
  | { kind: 'crypto-unavailable' }
  | { kind: 'encryption-failed'; detail: string }
  | { kind: 'download-failed'; detail: string };

export type BackupExportState =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'building' }
  | { kind: 'deriving' }
  | { kind: 'encrypting' }
  | { kind: 'ready'; json: string; filename: string }
  | { kind: 'downloaded'; filename: string }
  | { kind: 'error'; error: BackupExportError };

export interface BackupExportHook {
  state: BackupExportState;
  runExport: (password: string) => Promise<void>;
  reset: () => void;
}

/**
 * State machine for `.phylax` backup export.
 *
 * idle -> validating -> building -> deriving -> encrypting -> ready
 *                                                             |
 *                                                             v
 *                                                  auto-download (effect)
 *                                                             |
 *                                                             v
 *                                                       downloaded
 *
 * Any step may transition to `error`. `reset()` returns to `idle`.
 *
 * Derivation + encryption are collapsed into a single `createBackup`
 * call; the hook surfaces `deriving` before the call and `encrypting`
 * as a synthetic intermediate state so UI can show a progressive
 * message during the ~1.5s PBKDF2 wait.
 */
export function useBackupExport(): BackupExportHook {
  const [state, setState] = useState<BackupExportState>({ kind: 'idle' });

  const runExport = useCallback(async (password: string) => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setState({ kind: 'error', error: { kind: 'password-too-short' } });
      return;
    }

    setState({ kind: 'validating' });
    setState({ kind: 'building' });

    const dumpResult = await buildVaultDump();
    if (!dumpResult.ok) {
      if (dumpResult.error.kind === 'locked') {
        setState({ kind: 'error', error: { kind: 'locked' } });
      } else if (dumpResult.error.kind === 'no-meta') {
        setState({ kind: 'error', error: { kind: 'no-profile' } });
      } else {
        setState({
          kind: 'error',
          error: { kind: 'encryption-failed', detail: dumpResult.error.detail },
        });
      }
      return;
    }

    if (dumpResult.dump.rows.profiles.length === 0) {
      setState({ kind: 'error', error: { kind: 'no-profile' } });
      return;
    }

    setState({ kind: 'deriving' });
    // Yield to the event loop so React can paint the "deriving" status
    // before the PBKDF2 loop blocks the main thread.
    await new Promise((resolve) => setTimeout(resolve, 0));

    setState({ kind: 'encrypting' });
    const backup = await createBackup(dumpResult.dump, password);
    if (!backup.ok) {
      setState({
        kind: 'error',
        error:
          backup.error.kind === 'crypto-unavailable'
            ? { kind: 'crypto-unavailable' }
            : { kind: 'encryption-failed', detail: backup.error.detail },
      });
      return;
    }

    const filename = formatBackupFilename();
    setState({ kind: 'ready', json: backup.json, filename });
  }, []);

  // Auto-download once the envelope is ready. The transition to
  // `downloaded` is driven by this effect so the synchronous download
  // call happens during a React commit phase, which browsers accept
  // as a user-initiated gesture in the same task as the form submit.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    try {
      downloadBackup(state.json, state.filename);
      setState({ kind: 'downloaded', filename: state.filename });
    } catch (err) {
      setState({
        kind: 'error',
        error: { kind: 'download-failed', detail: String(err) },
      });
    }
  }, [state]);

  const reset = useCallback(() => {
    setState({ kind: 'idle' });
  }, []);

  return { state, runExport, reset };
}
