import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { setupServiceWorker } from '../../pwa/registerServiceWorker';

interface UpdateContextValue {
  /** True once a new SW is installed and waiting to take over. */
  needRefresh: boolean;
  /** Apply the waiting SW. Triggers a page reload. */
  apply: () => void;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

/**
 * Provides PWA update state + action to the entire app.
 *
 * Lifted from App.tsx so the Header indicator (UpdateIndicator) can
 * read state without prop-drilling. SW registration runs once on
 * mount; calling `apply()` activates the waiting SW and reloads.
 *
 * BUG-01 history: Phylax runs in `registerType: 'prompt'` mode
 * (vite.config.ts) so the new SW does not auto-reload. The user
 * applies the update via UpdateIndicator at a safe time of their
 * choosing — never mid-unlock.
 *
 * Implementation note: the `updateSW` function is held in a ref
 * (not React state) so `apply` does not need a defensive null
 * check. `apply` is only invoked from a user click after the
 * Header has rendered, which is necessarily after the mount-time
 * useEffect has populated the ref. Using state here would create
 * a "first render before useEffect" branch that is impractical to
 * cover in tests because the user gesture cannot fire in that
 * window.
 */
export function UpdateProvider({ children }: { children: ReactNode }) {
  const [needRefresh, setNeedRefresh] = useState(false);
  // The placeholder noop runs only between the first render and the
  // mount-time useEffect; `apply()` is wired to a user click that
  // cannot fire in that window, so the placeholder is provably
  // unreachable. The /* v8 ignore */ comment keeps coverage honest
  // about that — without it the placeholder shows as an uncovered
  // function and drops `src/features/pwa-update/**` below the 100%
  // function threshold.
  const updateSWRef = useRef<() => void>(/* v8 ignore next */ () => undefined);

  useEffect(() => {
    updateSWRef.current = setupServiceWorker(() => {
      setNeedRefresh(true);
    });
  }, []);

  const apply = useCallback(() => {
    updateSWRef.current();
  }, []);

  const value = useMemo(() => ({ needRefresh, apply }), [needRefresh, apply]);

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

/**
 * Read current update state. Returns a default `{ needRefresh: false }`
 * fallback when used outside the provider, which keeps test mounts
 * (e.g. isolated Header tests) free of provider boilerplate at the
 * cost of swallowing the case where a consumer forgets to wrap. The
 * fallback is intentionally inert — `apply` is a no-op.
 */
export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (ctx) return ctx;
  return { needRefresh: false, apply: () => undefined };
}
