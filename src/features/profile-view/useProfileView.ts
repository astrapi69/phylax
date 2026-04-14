import { useEffect, useState } from 'react';
import type { Profile } from '../../domain';
import { ProfileRepository } from '../../db/repositories';

export type ProfileViewState =
  | { kind: 'loading' }
  | { kind: 'loaded'; profile: Profile }
  | { kind: 'error'; message: string };

export interface UseProfileViewResult {
  state: ProfileViewState;
}

/**
 * Load the current profile once on mount. Caches for the component
 * lifetime. Route re-navigation re-triggers the hook for a fresh read;
 * reactive updates are deferred to a later task.
 *
 * RequireProfile guards the route, so a null profile is a defensive
 * error branch rather than a normal state.
 */
export function useProfileView(): UseProfileViewResult {
  const [state, setState] = useState<ProfileViewState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = new ProfileRepository();
        const profile = await repo.getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setState({ kind: 'error', message: 'Kein Profil gefunden.' });
          return;
        }
        setState({ kind: 'loaded', profile });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Profil konnte nicht geladen werden.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state };
}
