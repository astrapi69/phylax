import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  clearStoredActiveProfileId,
  readStoredActiveProfileId,
  writeStoredActiveProfileId,
} from './activeProfileStorage';

/**
 * Active-profile context (M-04). Holds the id of the profile the user
 * is currently viewing. Persisted to `phylax-active-profile` in
 * localStorage so a reload restores the same scope.
 *
 * The provider does NOT load profile rows itself - it only owns the
 * selection. Consumers that need the full profile data call
 * `ProfileRepository.get(activeProfileId)` after the keystore is
 * unlocked (typically inside a hook's effect).
 *
 * On first run, before any profile exists, `activeProfileId` is null.
 * The onboarding flow's `useProfileCreate` calls `setActiveProfileId`
 * with the freshly-created profile id so the rest of the app picks it
 * up without an explicit selection step.
 *
 * Single-profile installations remain a degenerate case: after
 * onboarding the lone profile is active and the user never sees the
 * switcher; new code reads `activeProfileId` and gets the right value
 * for free.
 */
export interface ActiveProfileContextValue {
  /** Id of the currently-active profile, or null before onboarding. */
  activeProfileId: string | null;
  /** Switch the active profile (or clear it with null). */
  setActiveProfileId: (id: string | null) => void;
}

export const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null);

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(() =>
    readStoredActiveProfileId(),
  );

  // Sync across tabs: when another tab switches profile, this tab
  // picks up the change at the next storage event. Avoids the
  // "Tab A shows Anna, Tab B shows Bernd" inconsistency that would
  // otherwise persist until reload.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'phylax-active-profile') return;
      const next = e.newValue ?? null;
      setActiveProfileIdState(next === '' ? null : next);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setActiveProfileId = useCallback((id: string | null) => {
    if (id === null) {
      clearStoredActiveProfileId();
    } else {
      writeStoredActiveProfileId(id);
    }
    setActiveProfileIdState(id);
  }, []);

  const value = useMemo<ActiveProfileContextValue>(
    () => ({ activeProfileId, setActiveProfileId }),
    [activeProfileId, setActiveProfileId],
  );

  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

/**
 * Consume the active-profile context.
 *
 * Returns a fallback `{ activeProfileId: <stored> | null, setActiveProfileId: noop }`
 * when no provider is present. The fallback reads directly from
 * localStorage so feature hooks rendered outside a provider (test
 * environments that wrap with `<MemoryRouter>` only, ad-hoc Storybook
 * harnesses) still see the right id but cannot mutate it.
 *
 * The non-throwing variant is the deliberate trade-off for the
 * MVP-to-multi-profile migration: many existing tests do not yet wrap
 * in `ActiveProfileProvider`, and forcing each to do so is mechanical
 * churn that does not buy correctness. Production rendering always
 * goes through `main.tsx` which mounts the provider.
 */
export function useActiveProfile(): ActiveProfileContextValue {
  const ctx = useContext(ActiveProfileContext);
  if (ctx !== null) return ctx;
  return {
    activeProfileId: readStoredActiveProfileId(),
    setActiveProfileId: () => {
      /* no-op outside provider */
    },
  };
}
