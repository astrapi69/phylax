import { useCallback, useState } from 'react';
import { db } from '../../db/schema';
import { lock } from '../../crypto';

/** Dexie database name. Wipe target for `indexedDB.deleteDatabase`. */
export const DEXIE_DB_NAME = 'phylax';

/**
 * Storage key prefix convention for Phylax. All localStorage and
 * sessionStorage keys use either `phylax-` (hyphen) or `phylax.` (dot).
 * The full-data reset relies on this convention to enumerate keys
 * without maintaining a hand-curated list. New keys MUST follow the
 * convention or they will not be cleared by reset.
 *
 * See `CLAUDE.md` "Browser storage key convention" for the project
 * rule.
 */
const PHYLAX_STORAGE_KEY_PATTERN = /^phylax[.-]/;

export type ResetStep =
  | 'idle'
  | 'closing-db'
  | 'deleting-db'
  | 'clearing-storage'
  | 'clearing-caches'
  | 'unregistering-sw'
  | 'navigating'
  | 'done';

export interface ResetResult {
  /** True if every wipe step completed without raising. */
  fullySucceeded: boolean;
  /** Per-step error log; empty when `fullySucceeded` is true. */
  errors: ResetStepError[];
}

export interface ResetStepError {
  step: ResetStep;
  message: string;
}

export interface UseResetAllDataResult {
  /** Current step in the wipe sequence; `'idle'` until `reset()` runs. */
  step: ResetStep;
  /**
   * `true` while the wipe is in flight. Use to disable the trigger
   * button and surface a "deleting…" message.
   */
  inProgress: boolean;
  /** Latest result, populated after the wipe completes (success or partial). */
  result: ResetResult | null;
  /** Special `'blocked'` flag for the `indexedDB.deleteDatabase` blocked event. */
  blocked: boolean;
  /**
   * Run the full wipe sequence. Best-effort: every step runs even if
   * a prior one threw; per-step errors collected into `result.errors`.
   * On full success, navigates to `import.meta.env.BASE_URL` (the app
   * root, accounting for subpath deployments like GitHub Pages) via
   * `location.replace` (history-clean).
   */
  reset: () => Promise<void>;
}

/**
 * Full data reset hook.
 *
 * Wipe sequence (best-effort, per-step try/catch):
 * 1. `lock()` to clear in-memory crypto key.
 * 2. Dexie `db.close()` to release IndexedDB connection locks.
 * 3. `indexedDB.deleteDatabase('phylax')` with `onsuccess` / `onerror` /
 *    `onblocked` Promise wrapping. `onblocked` surfaces via the
 *    `blocked` flag - caller's UI shows a "close other Phylax tabs"
 *    message and lets the user retry.
 * 4. Iterate `localStorage` and `sessionStorage`, remove every key
 *    matching the Phylax prefix convention.
 * 5. Iterate `caches.keys()` and delete each.
 * 6. `navigator.serviceWorker.getRegistration()?.unregister()`.
 * 7. `window.location.replace(import.meta.env.BASE_URL)` for clean
 *    fresh-start navigation (NOT `.reload()` - we want history cleared
 *    so back-button does not return to a dead viewer URL).
 *    `BASE_URL` resolves to `/` in dev and `/phylax/` in production
 *    builds (GitHub Pages subpath); hardcoded `/` would exit the
 *    React Router scope on subpath deployments.
 *
 * Failures are caught and logged into `result.errors`. The orchestrator
 * never throws; the caller distinguishes full vs partial success via
 * `result.fullySucceeded`.
 */
export function useResetAllData(): UseResetAllDataResult {
  const [step, setStep] = useState<ResetStep>('idle');
  const [inProgress, setInProgress] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);

  const reset = useCallback(async () => {
    setInProgress(true);
    setBlocked(false);
    setResult(null);
    const errors: ResetStepError[] = [];

    setStep('closing-db');
    try {
      lock();
      db.close();
    } catch (err) {
      errors.push({ step: 'closing-db', message: errorMessage(err) });
    }

    setStep('deleting-db');
    try {
      await deleteDatabase(DEXIE_DB_NAME, () => setBlocked(true));
    } catch (err) {
      errors.push({ step: 'deleting-db', message: errorMessage(err) });
    }

    setStep('clearing-storage');
    try {
      wipeStorageByPrefix(window.localStorage);
      wipeStorageByPrefix(window.sessionStorage);
    } catch (err) {
      errors.push({ step: 'clearing-storage', message: errorMessage(err) });
    }

    setStep('clearing-caches');
    try {
      await wipeCaches();
    } catch (err) {
      errors.push({ step: 'clearing-caches', message: errorMessage(err) });
    }

    setStep('unregistering-sw');
    try {
      await unregisterServiceWorker();
    } catch (err) {
      errors.push({ step: 'unregistering-sw', message: errorMessage(err) });
    }

    setStep('navigating');
    const finalResult: ResetResult = { fullySucceeded: errors.length === 0, errors };
    setResult(finalResult);
    setStep('done');
    setInProgress(false);

    // Navigate after state is settled so the parent component can
    // observe `result` for telemetry-free logging if it wants.
    // history-clean navigation: replace, not reload, so back-button
    // does not return to a dead URL. `BASE_URL` keeps the redirect
    // inside the React Router scope on subpath deployments (e.g.,
    // `/phylax/` on GitHub Pages); hardcoded `/` would exit it.
    window.location.replace(import.meta.env.BASE_URL);
  }, []);

  return { step, inProgress, result, blocked, reset };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Wipe Phylax-prefixed keys from a Storage instance. Two-pass
 * (collect-then-remove) because removing during iteration shifts
 * indices on a live `Storage` object.
 */
function wipeStorageByPrefix(storage: Storage): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && PHYLAX_STORAGE_KEY_PATTERN.test(key)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

/**
 * Promise-wrap `indexedDB.deleteDatabase`. Resolves on `onsuccess`,
 * rejects on `onerror`, calls `onBlocked` (and resolves) on
 * `onblocked` so the caller can surface a user-actionable message.
 */
function deleteDatabase(name: string, onBlocked: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => {
      onBlocked();
      // Resolve even on blocked: the wipe sequence continues
      // best-effort. The blocked flag surfaces the user-actionable
      // message ("close other tabs") without halting the rest of
      // the wipe.
      resolve();
    };
  });
}

async function wipeCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}

async function unregisterServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) await reg.unregister();
}
