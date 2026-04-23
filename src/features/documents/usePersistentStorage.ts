import { useCallback, useEffect, useState } from 'react';

export type PersistenceState =
  | { kind: 'unknown' }
  | { kind: 'persisted' }
  | { kind: 'transient' }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

export interface UsePersistentStorageOptions {
  /**
   * Caller-owned refetch trigger. Bump after a
   * `requestPersistence()` call to re-probe `navigator.storage.persisted()`.
   */
  versionKey?: number;
}

export interface UsePersistentStorageResult {
  state: PersistenceState;
  /**
   * Request persistent storage. Fire-and-forget: callers do not
   * await this because `persist()` can prompt on some browsers
   * (Firefox) or take a moment; upload-success propagation must not
   * be blocked.
   *
   * Internally de-duplicated via a module-level guard so a second
   * call in the same page load is a no-op — prevents re-prompting
   * after a denial.
   */
  requestPersistence: () => void;
}

/**
 * Module-level flag so one page load makes at most one
 * `navigator.storage.persist()` call. Set by the first
 * `requestPersistence()`, reset only by
 * `__resetPersistentStorageSession()` (test-only) or a fresh page
 * load. A fresh page load deserves a fresh probe because the user
 * may have granted permission manually (browser settings, PWA
 * install) in the interim.
 */
let hasRequestedThisSession = false;

/**
 * Last request outcome. Surfaces the `denied` state to the hook
 * even after a subsequent `persisted()` probe returns false
 * (because, without this memory, we cannot distinguish "never
 * asked" from "asked and refused").
 */
let lastRequestResult: 'granted' | 'denied' | null = null;

/**
 * Read + request persistent-storage permission.
 *
 * Probe is non-invasive: `persisted()` does not prompt. The
 * invasive call is `persist()`, triggered only by
 * `requestPersistence()` which upload-success calls after
 * every upload whose persistence state is still transient.
 *
 * States:
 * - `unknown`: probe has not completed yet (first render).
 * - `persisted`: storage is already persistent.
 * - `transient`: browser has not granted persistence and the user
 *   has not been asked yet this session.
 * - `denied`: persist() was called this session and the browser
 *   refused. The banner surfaces this. Survives across re-mounts
 *   of the hook.
 * - `unavailable`: API is missing (old browsers, insecure
 *   contexts). Component treats the same as `persisted` — silent.
 */
export function usePersistentStorage(
  options: UsePersistentStorageOptions = {},
): UsePersistentStorageResult {
  const { versionKey = 0 } = options;
  const [state, setState] = useState<PersistenceState>({ kind: 'unknown' });

  useEffect(() => {
    let cancelled = false;
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage || typeof storage.persisted !== 'function') {
      setState({ kind: 'unavailable' });
      return;
    }
    storage
      .persisted()
      .then((persisted) => {
        if (cancelled) return;
        if (persisted) {
          setState({ kind: 'persisted' });
          return;
        }
        if (hasRequestedThisSession && lastRequestResult === 'denied') {
          setState({ kind: 'denied' });
          return;
        }
        setState({ kind: 'transient' });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [versionKey]);

  const requestPersistence = useCallback(() => {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (
      !storage ||
      typeof storage.persist !== 'function' ||
      typeof storage.persisted !== 'function'
    ) {
      return;
    }
    if (hasRequestedThisSession) return;
    hasRequestedThisSession = true;

    storage
      .persisted()
      .then((already) => {
        if (already) {
          lastRequestResult = 'granted';
          return true;
        }
        return storage.persist();
      })
      .then((granted) => {
        lastRequestResult = granted ? 'granted' : 'denied';
      })
      .catch(() => {
        lastRequestResult = 'denied';
      });
  }, []);

  return { state, requestPersistence };
}

/** Test-only: reset module-level session flags. */
export function __resetPersistentStorageSession(): void {
  hasRequestedThisSession = false;
  lastRequestResult = null;
}
