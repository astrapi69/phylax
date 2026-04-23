import { useEffect, useState } from 'react';

export type StorageQuotaState =
  | { kind: 'loading' }
  | { kind: 'loaded'; usageBytes: number; quotaBytes: number; percent: number }
  | { kind: 'unavailable' }
  | { kind: 'error'; detail: string };

export interface UseStorageQuotaOptions {
  /**
   * Bump to force a re-read of `navigator.storage.estimate()` after
   * an upload or delete changes the underlying bytes. Same pattern
   * as `useDocuments` so the caller can share one counter.
   */
  versionKey?: number;
}

/**
 * Read the browser's storage-quota estimate for the current origin.
 *
 * Browser support: Chromium, Firefox, Edge, Safari all ship
 * `navigator.storage.estimate()` on modern versions. Old browsers
 * and non-secure-context edge cases get `kind: 'unavailable'`; the
 * component renders nothing and a one-time dev-console warning
 * explains the gap.
 *
 * Percent rule: `Math.floor(usage / quota * 100)` so a display of
 * "100%" only appears when the user is truly at quota. A raw round
 * of 99.7% would surface as "100%" while ~0.3% of quota is still
 * free and uploads still succeed, which is confusing. `Math.floor`
 * caps the displayed value at 99 until the true ratio crosses 100.
 *
 * Units are BINARY (`1 MB = 1,048,576 bytes`) throughout, matching
 * how browser storage APIs report bytes and how dev-tools / OS
 * storage views display them. Decimal MB would drift ~5% and
 * surprise users cross-checking against their browser.
 */
export function useStorageQuota(options: UseStorageQuotaOptions = {}): StorageQuotaState {
  const { versionKey = 0 } = options;
  const [state, setState] = useState<StorageQuotaState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage || typeof storage.estimate !== 'function') {
      warnOnce('navigator.storage.estimate unavailable; storage quota indicator will be hidden.');
      setState({ kind: 'unavailable' });
      return;
    }

    setState({ kind: 'loading' });

    storage
      .estimate()
      .then((estimate) => {
        if (cancelled) return;
        const usageBytes = estimate.usage ?? 0;
        const quotaBytes = estimate.quota ?? 0;
        if (quotaBytes <= 0) {
          // Zero quota reported: treat as loaded-with-zero so the
          // component still renders a usage figure (it is
          // information) but the percent is 0, not NaN.
          setState({ kind: 'loaded', usageBytes, quotaBytes: 0, percent: 0 });
          return;
        }
        const rawRatio = usageBytes / quotaBytes;
        const percent = Math.min(99, Math.floor(rawRatio * 100));
        setState({ kind: 'loaded', usageBytes, quotaBytes, percent });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [versionKey]);

  return state;
}

/**
 * Module-level guard so the dev-console warning fires exactly once
 * per page load, not once per component mount. React StrictMode
 * double-invokes effects, and re-renders can remount the hook if
 * the caller changes (e.g. navigating back to the documents view);
 * without this flag, the dev console would fill up.
 */
let unavailableWarned = false;
function warnOnce(message: string): void {
  if (unavailableWarned) return;
  unavailableWarned = true;
  console.warn(message);
}

/** Reset the warn-once flag. Test-only. */
export function __resetStorageQuotaWarn(): void {
  unavailableWarned = false;
}
