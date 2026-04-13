import { useEffect, useRef } from 'react';
import { getLockState, lock, onLockStateChange } from '../../crypto';
import { ACTIVITY_EVENTS } from './config';

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
    const unsubscribe = onLockStateChange((state) => {
      if (state === 'unlocked') {
        attachListeners();
        startTimer();
      } else {
        detachListeners();
        clearTimer();
      }
    });

    return () => {
      unsubscribe();
      detachListeners();
      clearTimer();
    };
  }, [timeoutMinutes]);
}
