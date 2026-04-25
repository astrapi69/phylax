import { useCallback, useEffect, useState } from 'react';
import type { Supplement, SupplementCategory } from '../../domain';
import { ProfileRepository, SupplementRepository } from '../../db/repositories';

export interface SupplementGroup {
  category: SupplementCategory;
  supplements: Supplement[];
}

export type SupplementsError = { kind: 'no-profile' } | { kind: 'generic'; detail: string };

export type SupplementsState =
  | { kind: 'loading' }
  | { kind: 'loaded'; groups: SupplementGroup[] }
  | { kind: 'error'; error: SupplementsError };

export interface UseSupplementsResult {
  state: SupplementsState;
  /**
   * Re-run the load. Used by O-14 form/delete success paths to refresh
   * the list without a full route navigation. Direct call (not pub/sub)
   * for traceability — mirrors the O-10/O-12a pattern.
   */
  refetch: () => void;
}

const CATEGORY_ORDER: readonly SupplementCategory[] = [
  'daily',
  'regular',
  'on-demand',
  'paused',
] as const;

/**
 * Load all supplements for the current profile and group by category.
 * Active categories (daily, regular, on-demand) come first; paused
 * last. Empty categories are excluded. Within each group, supplements
 * are sorted by createdAt ascending (preserves import order).
 */
export function useSupplements(): UseSupplementsResult {
  const [state, setState] = useState<SupplementsState>({ kind: 'loading' });
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileRepo = new ProfileRepository();
        const profile = await profileRepo.getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setState({ kind: 'error', error: { kind: 'no-profile' } });
          return;
        }

        const repo = new SupplementRepository();
        const all = await repo.listByProfile(profile.id);
        if (cancelled) return;

        const groups = buildGroups(all);
        setState({ kind: 'loaded', groups });
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
  }, [version]);

  return { state, refetch };
}

function buildGroups(supplements: Supplement[]): SupplementGroup[] {
  const byCategory = new Map<SupplementCategory, Supplement[]>();
  for (const s of supplements) {
    const existing = byCategory.get(s.category);
    if (existing) {
      existing.push(s);
    } else {
      byCategory.set(s.category, [s]);
    }
  }

  const groups: SupplementGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const list = byCategory.get(category);
    if (!list || list.length === 0) continue;
    groups.push({
      category,
      supplements: [...list].sort((a, b) => a.createdAt - b.createdAt),
    });
  }
  return groups;
}
