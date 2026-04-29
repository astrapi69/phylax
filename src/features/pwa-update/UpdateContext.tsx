import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
 */
export function UpdateProvider({ children }: { children: ReactNode }) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => void) | null>(null);

  useEffect(() => {
    const doUpdate = setupServiceWorker(() => {
      setNeedRefresh(true);
    });
    setUpdateSW(() => doUpdate);
  }, []);

  const apply = useCallback(() => {
    if (updateSW) updateSW();
  }, [updateSW]);

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
