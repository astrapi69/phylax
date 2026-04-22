import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { metaExists } from '../db/meta';

type GuardState = 'checking' | 'allowed' | 'redirect';

/**
 * Layout guard for the setup-flow routes (`/welcome`, `/privacy`,
 * `/setup`). Redirects to `/unlock` when a vault already exists so a
 * direct-link visit cannot reach `useSetupVault.runSetup()` and
 * overwrite meta.
 *
 * Renders null during the single meta-read tick (matches EntryRouter's
 * loading style; avoids a brief welcome-screen flash before the
 * redirect fires). Children render via `<Outlet />` once the check
 * clears.
 *
 * Fail-open on metaExists rejection: if the IndexedDB read throws (e.g.
 * Safari-private-mode quirks, DB corruption, or a broken shim), the
 * guard lets the setup flow render rather than trapping the user on a
 * blank screen. The defensive check inside `useSetupVault.runSetup()`
 * still refuses to overwrite an existing vault, so fail-open on the
 * guard does not re-open the data-loss path.
 */
export function SetupFlowGuard() {
  const [state, setState] = useState<GuardState>('checking');

  useEffect(() => {
    let cancelled = false;
    metaExists()
      .then((exists) => {
        if (cancelled) return;
        setState(exists ? 'redirect' : 'allowed');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('SetupFlowGuard: metaExists failed, allowing setup flow', err);
        setState('allowed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') return null;
  if (state === 'redirect') return <Navigate to="/unlock" replace />;
  return <Outlet />;
}
