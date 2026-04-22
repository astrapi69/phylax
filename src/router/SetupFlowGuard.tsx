import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { resolveAuthState } from './resolveAuthState';

type GuardResult = 'checking' | 'allowed' | 'locked' | 'unlocked';

/**
 * Layout guard for the setup-flow routes (`/welcome`, `/privacy`,
 * `/setup`). Maps the shared auth state to a per-state redirect policy:
 *
 * - `no-vault`: renders children (first-run setup flow).
 * - `locked`:   redirects to `/unlock` (user must re-authenticate
 *   before reaching anything vault-aware).
 * - `unlocked`: redirects to `/profile` (authenticated user has no
 *   reason to see the setup flow; forcing them through `/unlock`
 *   would be a needless re-authentication).
 *
 * Reads auth state via the shared `resolveAuthState` helper (TD-06).
 *
 * Renders null during the single state-read tick (matches EntryRouter's
 * loading style; avoids a brief welcome-screen flash before the
 * redirect fires). Children render via `<Outlet />` once the check
 * clears.
 *
 * Fail-open on resolveAuthState rejection: if the IndexedDB read throws
 * (e.g. Safari-private-mode quirks, DB corruption, or a broken shim),
 * the guard lets the setup flow render rather than trapping the user
 * on a blank screen. The defensive check inside
 * `useSetupVault.runSetup()` still refuses to overwrite an existing
 * vault, so fail-open on the guard does not re-open the data-loss path.
 */
export function SetupFlowGuard() {
  const [result, setResult] = useState<GuardResult>('checking');

  useEffect(() => {
    let cancelled = false;
    resolveAuthState()
      .then((authState) => {
        if (cancelled) return;
        setResult(authState === 'no-vault' ? 'allowed' : authState);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('SetupFlowGuard: resolveAuthState failed, allowing setup flow', err);
        setResult('allowed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (result === 'checking') return null;
  if (result === 'locked') return <Navigate to="/unlock" replace />;
  if (result === 'unlocked') return <Navigate to="/profile" replace />;
  return <Outlet />;
}
