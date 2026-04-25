import { useEffect } from 'react';

/**
 * Module-level counter shared across every `useBodyScrollLock`
 * instance in the process. Per-hook-instance state would race when
 * two modals open simultaneously: instance B's local counter says
 * 1 while instance A's hook also thinks count is 1, and closing A
 * releases the lock while B is still open.
 *
 * Single mutable counter at module scope avoids that. Increment on
 * mount, decrement on unmount, restore overflow only when counter
 * hits 0 (last modal closed).
 */
let lockCount = 0;
let originalOverflow: string | null = null;

/**
 * While `enabled` is true and the hook is mounted, set
 * `document.body.style.overflow = 'hidden'`. Counter-managed so
 * multiple simultaneously-mounted hooks don't release the lock
 * prematurely.
 *
 * Test escape hatch: `__resetForTest` zeros the counter + restores
 * overflow. Used by hook unit tests to isolate scenarios; never
 * call in production code.
 */
export function useBodyScrollLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow ?? '';
        originalOverflow = null;
      }
    };
  }, [enabled]);
}

/** Test-only reset. Do not call in production. */
export function __resetForTest(): void {
  lockCount = 0;
  originalOverflow = null;
  document.body.style.overflow = '';
}
