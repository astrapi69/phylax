/**
 * Reference-counted auto-lock pause primitive (P-06, ADR-0018 Section 4).
 *
 * Long-running operations that hold the keyStore unlocked but have no
 * user input (re-encryption, backup-restore, large imports) call
 * `pauseAutoLock()` at start and the returned unpause callback when
 * done (typically in a `finally` block so the timer resumes on both
 * success and failure paths).
 *
 * Reference-counted: nested or concurrent pauses stack. The auto-lock
 * timer resumes only when every consumer has released. This prevents
 * a sloppy double-pause / single-resume from leaving auto-lock
 * disabled forever.
 *
 * Pure module-level state with a listener bus so React hooks can
 * subscribe and react to pause-state transitions without polling.
 */

let pauseDepth = 0;
const listeners = new Set<(paused: boolean) => void>();

function notify(paused: boolean): void {
  for (const listener of listeners) {
    try {
      listener(paused);
    } catch (err) {
      console.error('Auto-lock pause listener threw:', err);
    }
  }
}

/**
 * Pause auto-lock. Returns an idempotent release callback. Calling the
 * release a second time is a no-op (so callers can safely register it
 * in a `finally` block even when the operation completes successfully
 * via a different path).
 */
export function pauseAutoLock(): () => void {
  const wasPaused = pauseDepth > 0;
  pauseDepth++;
  if (!wasPaused) notify(true);

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    pauseDepth--;
    if (pauseDepth === 0) notify(false);
  };
}

/**
 * Current pause state. True iff at least one consumer holds a pause.
 */
export function isAutoLockPaused(): boolean {
  return pauseDepth > 0;
}

/**
 * Subscribe to pause-state transitions. Returns an unsubscribe.
 * Listeners fire on the locked-to-paused and paused-to-unlocked
 * transitions only, not for every nested increment / decrement.
 */
export function onAutoLockPauseChange(listener: (paused: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test-only helper: forcibly reset the pause counter and clear all
 * listeners. Production code never needs this; tests use it between
 * cases to guarantee a clean module state.
 */
export function __resetAutoLockPauseStateForTests(): void {
  pauseDepth = 0;
  listeners.clear();
}
