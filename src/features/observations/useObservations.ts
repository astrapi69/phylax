import { useEffect, useState } from 'react';
import type { Observation } from '../../domain';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';

export interface ThemeGroup {
  theme: string;
  observations: Observation[];
}

export type ObservationsState =
  | { kind: 'loading' }
  | { kind: 'loaded'; groups: ThemeGroup[] }
  | { kind: 'error'; message: string };

export interface UseObservationsResult {
  state: ObservationsState;
}

/**
 * Load all observations for the current profile, group by theme, and
 * sort groups and observations by German-locale collation. Groups are
 * sorted alphabetically by theme, observations within a group by their
 * first non-empty sort key (fact one-liner or createdAt as tiebreaker).
 */
export function useObservations(): UseObservationsResult {
  const [state, setState] = useState<ObservationsState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileRepo = new ProfileRepository();
        const profile = await profileRepo.getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setState({ kind: 'error', message: 'Kein Profil gefunden.' });
          return;
        }

        const obsRepo = new ObservationRepository();
        const all = await obsRepo.listByProfile(profile.id);
        if (cancelled) return;

        const groups = groupByTheme(all);
        setState({ kind: 'loaded', groups });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message:
              err instanceof Error ? err.message : 'Beobachtungen konnten nicht geladen werden.',
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

function groupByTheme(observations: Observation[]): ThemeGroup[] {
  const map = new Map<string, Observation[]>();
  for (const obs of observations) {
    const existing = map.get(obs.theme);
    if (existing) {
      existing.push(obs);
    } else {
      map.set(obs.theme, [obs]);
    }
  }

  const collator = new Intl.Collator('de');
  const groups: ThemeGroup[] = Array.from(map.entries()).map(([theme, list]) => ({
    theme,
    observations: [...list].sort((a, b) => a.createdAt - b.createdAt),
  }));
  groups.sort((a, b) => collator.compare(a.theme, b.theme));
  return groups;
}
