import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { resolveAuthState, type AuthState } from './resolveAuthState';

/**
 * Root entry decision. Mounted at `/` by the AppRoutes tree.
 *
 * - No meta row in IndexedDB           -> /welcome   (first-run path)
 * - Meta row present, keystore locked  -> /unlock    (returning user)
 * - Meta row present, keystore unlocked -> /profile  (authenticated home)
 *
 * Reads auth state via the shared `resolveAuthState` helper (TD-06);
 * ProtectedRoute and SetupFlowGuard share the same source of truth.
 *
 * Renders null during the single meta-read tick; IndexedDB index
 * lookups are sub-millisecond so the blank frame is invisible. A
 * visible loading indicator would cause a flash before the redirect.
 */
export function EntryRouter() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveAuthState().then((state) => {
      if (cancelled) return;
      setTarget(stateToEntryDestination(state));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (target === null) return null;
  return <Navigate to={target} replace />;
}

/**
 * EntryRouter's policy for mapping the shared auth state to a
 * destination. Co-located because the mapping is EntryRouter-specific:
 * unlocked users land on `/profile` _here_; other consumers map the
 * same state to other actions (ProtectedRoute renders children on
 * unlocked; SetupFlowGuard sends locked users to /unlock and unlocked
 * users to /profile).
 */
function stateToEntryDestination(state: AuthState): string {
  switch (state) {
    case 'no-vault':
      return '/welcome';
    case 'locked':
      return '/unlock';
    case 'unlocked':
      return '/profile';
  }
}
