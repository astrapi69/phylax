import { useEffect, useState } from 'react';
import type { OpenPoint } from '../../domain';
import { OpenPointRepository, ProfileRepository } from '../../db/repositories';

export interface ContextGroup {
  context: string;
  items: OpenPoint[];
}

export type OpenPointsState =
  | { kind: 'loading' }
  | { kind: 'loaded'; groups: ContextGroup[] }
  | { kind: 'error'; message: string };

export interface UseOpenPointsResult {
  state: OpenPointsState;
}

/**
 * Load all open points for the current profile, group by context,
 * sort groups alphabetically (German locale). Within each group:
 * unresolved items first, then resolved; secondary sort by createdAt.
 */
export function useOpenPoints(): UseOpenPointsResult {
  const [state, setState] = useState<OpenPointsState>({ kind: 'loading' });

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

        const repo = new OpenPointRepository();
        const all = await repo.listByProfile(profile.id);
        if (cancelled) return;

        const groups = buildGroups(all);
        setState({ kind: 'loaded', groups });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message:
              err instanceof Error ? err.message : 'Offene Punkte konnten nicht geladen werden.',
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

function buildGroups(points: OpenPoint[]): ContextGroup[] {
  const byContext = new Map<string, OpenPoint[]>();
  for (const p of points) {
    const existing = byContext.get(p.context);
    if (existing) {
      existing.push(p);
    } else {
      byContext.set(p.context, [p]);
    }
  }

  const collator = new Intl.Collator('de');
  const groups: ContextGroup[] = Array.from(byContext.entries()).map(([context, items]) => ({
    context,
    items: [...items].sort(compareItems),
  }));
  groups.sort((a, b) => collator.compare(a.context, b.context));
  return groups;
}

function compareItems(a: OpenPoint, b: OpenPoint): number {
  if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
  return a.createdAt - b.createdAt;
}
