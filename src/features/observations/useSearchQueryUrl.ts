import { useCallback, useEffect, useRef } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

/** Idle window after which the next keystroke commits a new history entry. */
const SETTLE_MS = 500;

/**
 * URL-as-state hook for the observation search query (`?q=<term>`).
 *
 * Why settle-flag: writing the URL on every keystroke either spams
 * history (one entry per character) or stays stuck on the current
 * top (no Back/Forward across completed searches). Two parallel
 * effects (instant replace plus debounced push) race because a
 * subsequent replace overwrites the just-pushed entry.
 *
 * The settle-flag pattern resolves the race with a single decision
 * point: the first keystroke after `SETTLE_MS` of idle time pushes
 * a new history entry; subsequent keystrokes replace until idle
 * resumes. Result: each completed search becomes one history entry,
 * rapid typing produces no history spam, Back / Forward navigate
 * between completed searches as expected.
 *
 * Initial mount uses `settledRef = true`, so a URL-supplied query
 * (refresh, shared link) does not synthesize an extra history push;
 * only deliberate user typing creates entries.
 *
 * Same-value calls (X-click on already-empty input, paste of an
 * identical string) early-exit without touching the URL or the
 * settle state.
 *
 * Future O-18 (date-range filter) is the second concrete use case;
 * generalize the hook (e.g. `useUrlSearchParam`) when that lands,
 * not prophylactically.
 */
export function useSearchQueryUrl(
  query: string,
  setSearchParams: SetURLSearchParams,
): (next: string) => void {
  const settledRef = useRef(true);

  useEffect(() => {
    if (settledRef.current) return;
    const timer = setTimeout(() => {
      settledRef.current = true;
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return useCallback(
    (next: string) => {
      if (next === query) return;
      const shouldPush = settledRef.current;
      settledRef.current = false;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === '') params.delete('q');
          else params.set('q', next);
          return params;
        },
        { replace: !shouldPush },
      );
    },
    [query, setSearchParams],
  );
}
