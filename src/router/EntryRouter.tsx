import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getLockState } from '../crypto';
import { metaExists } from '../db/meta';

/**
 * Root entry decision. Mounted at `/` by the AppRoutes tree.
 *
 * - No meta row in IndexedDB           -> /welcome   (first-run path)
 * - Meta row present, keystore locked  -> /unlock    (returning user)
 * - Meta row present, keystore unlocked -> /profile  (authenticated home)
 *
 * Uses `metaExists()` + `getLockState()` directly (no new auth-guard
 * helper for now; the same decision logic lives in ProtectedRoute.
 * Consolidation into a shared `resolveAuthDestination()` is tracked as
 * a future tech-debt entry).
 *
 * Renders null during the single meta-read tick; IndexedDB index
 * lookups are sub-millisecond so the blank frame is invisible. A
 * visible loading indicator would cause a flash before the redirect.
 */
export function EntryRouter() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void metaExists().then((exists) => {
      if (cancelled) return;
      if (!exists) {
        setTarget('/welcome');
      } else if (getLockState() === 'locked') {
        setTarget('/unlock');
      } else {
        setTarget('/profile');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (target === null) return null;
  return <Navigate to={target} replace />;
}
