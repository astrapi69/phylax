import { useEffect, useRef } from 'react';
import { getLockState, lock, onLockStateChange } from '../../crypto';
import { ACTIVITY_EVENTS } from './config';
import { isAutoLockPaused, onAutoLockPauseChange } from './pauseStore';

/**
 * Hook that auto-locks the keyStore after a configurable inactivity timeout.
 *
 * Tracks user activity (mousemove, keydown, touchstart, click) on document.
 * Resets a setTimeout on each activity event. When the timer fires, calls lock().
 *
 * Only runs when keyStore is unlocked and timeoutMinutes > 0.
 * Subscribes to onLockStateChange to start/stop the timer dynamically.
 *
 * @param timeoutMinutes - minutes of inactivity before auto-lock.
 *   0 = disabled. Values are expected to be pre-clamped by the settings layer.
 */
export function useAutoLock(timeoutMinutes: number): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMsRef = useRef(timeoutMinutes * 60 * 1000);

  // Keep the timeout in sync if the prop changes
  useEffect(() => {
    timeoutMsRef.current = timeoutMinutes * 60 * 1000;
  }, [timeoutMinutes]);

  useEffect(() => {
    if (timeoutMinutes <= 0) return;

    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function startTimer() {
      clearTimer();
      // Skip the timer entirely while paused. Pause + resume cycles
      // are handled by the pause-listener below, which restarts the
      // timer fresh once every consumer releases its pause.
      if (isAutoLockPaused()) return;
      timerRef.current = setTimeout(() => {
        lock();
      }, timeoutMsRef.current);
    }

    function onActivity() {
      if (getLockState() === 'unlocked') {
        startTimer();
      }
    }

    function attachListeners() {
      for (const event of ACTIVITY_EVENTS) {
        document.addEventListener(event, onActivity, { passive: true });
      }
    }

    function detachListeners() {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, onActivity);
      }
    }

    // Start or stop based on current lock state
    if (getLockState() === 'unlocked') {
      attachListeners();
      startTimer();
    }

    // React to lock state changes from any source (manual lock, unlock, etc.)
    const unsubscribeLock = onLockStateChange((state) => {
      if (state === 'unlocked') {
        attachListeners();
        startTimer();
      } else {
        detachListeners();
        clearTimer();
      }
    });

    // React to pause-state transitions. While paused, kill any pending
    // timer so a long-running operation never trips auto-lock from a
    // pre-pause setTimeout. On resume, restart fresh from full timeout.
    const unsubscribePause = onAutoLockPauseChange((paused) => {
      if (paused) {
        clearTimer();
      } else if (getLockState() === 'unlocked') {
        startTimer();
      }
    });

    return () => {
      unsubscribeLock();
      unsubscribePause();
      detachListeners();
      clearTimer();
    };
  }, [timeoutMinutes]);
}
