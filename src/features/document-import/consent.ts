import type { ConsentRequiredReason } from './types';

/**
 * Module-level set of consent reasons granted for the current page
 * load. Resets to empty on every fresh page load - no localStorage,
 * no sessionStorage. Per IMP-02 design: persistent consent would
 * surprise users later (forgotten consent → unexpected data egress).
 * Per-file with optional session-remember is the safer default.
 *
 * The set lives at module scope so the consent decision survives
 * across React re-renders within one page load (each `usePrepare`
 * mount sees the same set), but does not leak into a new page load.
 */
const grantedReasons = new Set<ConsentRequiredReason>();

/**
 * True if the user has previously granted consent for `reason` in
 * this session and selected the "remember for this session"
 * checkbox in the dialog.
 */
export function isConsentGranted(reason: ConsentRequiredReason): boolean {
  return grantedReasons.has(reason);
}

/**
 * Record that the user has granted consent for `reason` for the
 * remainder of this page load. Idempotent.
 */
export function grantConsentForSession(reason: ConsentRequiredReason): void {
  grantedReasons.add(reason);
}

/**
 * Clear all session-granted consents. Test-only escape hatch; the
 * production path resets naturally on page reload.
 */
export function __resetConsentSession(): void {
  grantedReasons.clear();
}
