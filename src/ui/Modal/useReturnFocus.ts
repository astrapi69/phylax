import { useEffect } from 'react';

/**
 * On mount: record the currently-focused element. On unmount:
 * restore focus to that element.
 *
 * Defensive against trigger disappearance: if the recorded element
 * is no longer in the DOM at unmount time (e.g., the trigger button
 * unmounted while the modal was open), focus falls back to
 * `document.body` rather than throwing or focusing nothing.
 *
 * No-op when `enabled` is false (allows callers to wire conditionally
 * without violating Rules of Hooks).
 */
export function useReturnFocus(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const trigger = document.activeElement as HTMLElement | null;
    return () => {
      if (trigger && document.body.contains(trigger)) {
        trigger.focus();
      } else {
        document.body.focus();
      }
    };
  }, [enabled]);
}
