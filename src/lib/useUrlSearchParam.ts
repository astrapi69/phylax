import { useCallback, useEffect, useRef } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

/** Idle window after which the next set call commits a new history entry. */
const SETTLE_MS = 500;

/**
 * URL-as-state hook for a single text search-param (e.g. `?q=<term>`,
 * `?filter=<term>`).
 *
 * Why settle-flag: writing the URL on every keystroke either spams
 * history (one entry per character) or stays stuck on the current
 * top (no Back/Forward across completed searches). Two parallel
 * effects (instant replace plus debounced push) race because a
 * subsequent replace overwrites the just-pushed entry.
 *
 * The settle-flag pattern resolves the race with a single decision
 * point: the first set call after `SETTLE_MS` of idle time pushes
 * a new history entry; subsequent calls replace until idle resumes.
 * Result: each completed search becomes one history entry, rapid
 * typing produces no history spam, Back / Forward navigate between
 * completed searches as expected.
 *
 * Initial mount uses `settledRef = true`, so a URL-supplied value
 * (refresh, shared link) does not synthesize an extra history push;
 * only deliberate user input creates entries.
 *
 * Same-value calls (X-click on already-empty input, paste of an
 * identical string) early-exit without touching the URL or the
 * settle state.
 *
 * Generalized in P-22a from the observation-search-only
 * `useSearchQueryUrl` (the JSDoc on that earlier hook explicitly
 * called this generalization out as the second-consumer trigger).
 * Lab-Values, Supplements and Open-Points search all reuse this.
 *
 * @param paramKey  URL search-param name to read/write.
 * @param value     Current value (caller passes the URL-resolved value).
 * @param setSearchParams  React Router setter.
 */
export function useUrlSearchParam(
  paramKey: string,
  value: string,
  setSearchParams: SetURLSearchParams,
): (next: string) => void {
  const settledRef = useRef(true);

  useEffect(() => {
    if (settledRef.current) return;
    const timer = setTimeout(() => {
      settledRef.current = true;
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  return useCallback(
    (next: string) => {
      if (next === value) return;
      const shouldPush = settledRef.current;
      settledRef.current = false;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === '') params.delete(paramKey);
          else params.set(paramKey, next);
          return params;
        },
        { replace: !shouldPush },
      );
    },
    [paramKey, value, setSearchParams],
  );
}
