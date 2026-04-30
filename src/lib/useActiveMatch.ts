import { useCallback, useEffect, useState } from 'react';

/**
 * State machine for "active match" navigation across any rendered
 * search-result list (P-19, P-22b/c/d-polish). Indices are 1-based
 * when at least one match exists; 0 represents "no active match"
 * (empty query or zero-result state).
 *
 * Reset semantics: whenever the search query changes or the total
 * match count changes, the active index resets to the first match
 * (or 0 when there are no matches). The reset deliberately does NOT
 * trigger a scroll - typing should leave the viewport anchored at
 * the search input per the Q7-refined behaviour. Only explicit
 * navigation (next / prev) advances the scroll signal.
 *
 * Wraparound: next / prev wrap silently at the boundaries (Q6 lean).
 *
 * The `scrollSignal` increments on every next / prev call. The
 * caller's effect watches this signal and runs `scrollIntoView` on
 * the DOM target keyed by `activeIndex` (mark-level uses
 * `data-match-index`; row-level uses `data-match-row`). A signal
 * (instead of just `activeIndex`) lets the same active-index repeat
 * trigger another scroll, which matters when the user keeps pressing
 * the same direction at the boundary.
 */
export interface UseActiveMatchResult {
  /** 1-based index of the currently active match, or 0 when no matches. */
  activeIndex: number;
  /** Increments on every next / prev call to drive `scrollIntoView`. */
  scrollSignal: number;
  next: () => void;
  prev: () => void;
}

export function useActiveMatch(query: string, totalCount: number): UseActiveMatchResult {
  const [activeIndex, setActiveIndex] = useState(totalCount > 0 ? 1 : 0);
  const [scrollSignal, setScrollSignal] = useState(0);

  useEffect(() => {
    setActiveIndex(totalCount > 0 ? 1 : 0);
  }, [query, totalCount]);

  const next = useCallback(() => {
    if (totalCount === 0) return;
    setActiveIndex((idx) => {
      if (idx <= 0) return 1;
      if (idx >= totalCount) return 1;
      return idx + 1;
    });
    setScrollSignal((s) => s + 1);
  }, [totalCount]);

  const prev = useCallback(() => {
    if (totalCount === 0) return;
    setActiveIndex((idx) => {
      if (idx <= 1) return totalCount;
      return idx - 1;
    });
    setScrollSignal((s) => s + 1);
  }, [totalCount]);

  return { activeIndex, scrollSignal, next, prev };
}
