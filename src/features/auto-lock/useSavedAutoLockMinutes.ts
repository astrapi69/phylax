import { useEffect, useState } from 'react';
import { readAppSettings } from '../../db/appSettings';
import { DEFAULT_SETTINGS } from '../../db/settings';
import { getLockState, onLockStateChange } from '../../crypto';

/**
 * Read `autoLockMinutes` from the encrypted MetaPayload and keep it
 * in React state.
 *
 * Default value (`DEFAULT_SETTINGS.autoLockMinutes`) holds while the
 * keystore is locked or before the first read resolves. The hook
 * subscribes to lock-state changes so the value re-reads on every
 * unlock - including the first unlock of a session - without
 * forcing the caller to know about the encrypted-meta lifecycle.
 *
 * P-05 trade-off (per Q-lock): apply-on-reload for v1. The
 * AutoLockSection writes via `saveAppSettings`; when this hook
 * re-reads on the next unlock the new value reaches `useAutoLock`
 * and the timer restarts with it. Live-update across the same
 * session would need an event emitter on the saver; deferred until
 * a real complaint surfaces.
 *
 * Hook is no-op when keystore is locked - `decryptWithStoredKey`
 * would throw, which we catch and ignore so the hook can be safely
 * mounted at App.tsx top level (App is constructed before unlock).
 */
export function useSavedAutoLockMinutes(): number {
  const [minutes, setMinutes] = useState<number>(DEFAULT_SETTINGS.autoLockMinutes);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (getLockState() !== 'unlocked') return;
      /* v8 ignore start */
      // The cancel-after-await branch and the catch-on-decrypt-failure
      // branch only fire under tight unmount / lock races that are
      // brittle to reproduce in tests. Defensive code, intentionally
      // not gated on coverage.
      try {
        const settings = await readAppSettings();
        if (cancelled) return;
        setMinutes(settings.autoLockMinutes);
      } catch {
        // Decrypt or read failed (keystore raced to locked, IDB error).
        // Keep current value; next unlock retries.
      }
      /* v8 ignore stop */
    }

    void load();
    const unsub = onLockStateChange((state) => {
      if (state === 'unlocked') void load();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return minutes;
}
