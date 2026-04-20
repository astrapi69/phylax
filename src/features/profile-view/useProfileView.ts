import { useEffect, useState } from 'react';
import type { Profile } from '../../domain';
import { ProfileRepository } from '../../db/repositories';

/**
 * Discriminated error for the profile-view loader. The UI resolves each
 * kind to a translated message via i18next; the `detail` on `generic` is
 * preserved for logs and test assertions but is not rendered to the
 * user (deliberate: raw repository error messages are often unhelpful
 * and may leak implementation detail).
 */
export type ProfileViewError = { kind: 'not-found' } | { kind: 'generic'; detail: string };

export type ProfileViewState =
  | { kind: 'loading' }
  | { kind: 'loaded'; profile: Profile }
  | { kind: 'error'; error: ProfileViewError };

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
          setState({ kind: 'error', error: { kind: 'not-found' } });
          return;
        }
        setState({ kind: 'loaded', profile });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            error: {
              kind: 'generic',
              detail: err instanceof Error ? err.message : 'Unbekannter Fehler',
            },
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
