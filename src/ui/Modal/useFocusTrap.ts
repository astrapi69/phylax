import { useEffect, type RefObject } from 'react';

/**
 * Focusable selector. Excludes disabled, hidden, and aria-hidden
 * elements. Skipping these is a standard focus-trap gotcha - naive
 * implementations include disabled buttons in the trap and focus
 * unfocusable controls on Tab cycling.
 *
 * `[tabindex]:not([tabindex="-1"])` covers both `tabindex="0"` and
 * positive values; `tabindex="-1"` is programmatic-only and excluded.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
]
  .map((s) => `${s}:not([hidden]):not([aria-hidden="true"])`)
  .join(', ');

/**
 * Trap Tab/Shift+Tab focus inside `containerRef` while `enabled` is
 * true. On Tab from the last focusable, wraps to the first; on
 * Shift+Tab from the first, wraps to the last.
 *
 * No-ops if the container has zero focusable elements.
 *
 * Listener is scoped to `document.keydown`, not the container - Tab
 * from outside the container would otherwise bypass the trap.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [containerRef, enabled]);
}
