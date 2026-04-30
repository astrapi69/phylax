/**
 * P-07-c: respect `prefers-reduced-motion: reduce` for animated UI.
 *
 * Returns the appropriate `ScrollBehavior` for `Element.scrollIntoView`
 * (and similar APIs) based on the OS-level reduced-motion preference.
 * Vestibular-disorder users + general anti-motion preference get
 * instant scrolls; everyone else gets the smooth animation.
 *
 * Pure function read at call time (not memoised) because the OS
 * preference can change while the app is open. The matchMedia call is
 * cheap.
 *
 * SSR-safe: returns the smooth default when `window` is undefined.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pick a scroll behaviour for `scrollIntoView` calls. Defers to the
 * user's `prefers-reduced-motion` setting: `'auto'` (instant) when
 * reduced motion is requested, `'smooth'` otherwise.
 */
export function preferredScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
