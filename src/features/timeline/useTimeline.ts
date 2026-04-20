import { useEffect, useState } from 'react';
import type { TimelineEntry } from '../../domain';
import { ProfileRepository, TimelineEntryRepository } from '../../db/repositories';

export type TimelineError = { kind: 'no-profile' } | { kind: 'generic'; detail: string };

export type TimelineState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: TimelineEntry[] }
  | { kind: 'error'; error: TimelineError };

export interface UseTimelineResult {
  state: TimelineState;
}

/**
 * Load all timeline entries for the current profile, newest first.
 *
 * The repository returns entries sorted by createdAt ascending
 * (insertion order). We reverse to newest-first for display, since
 * timeline views are typically scanned most-recent-first. createdAt
 * is used as the sort key because the period field is free text
 * ("Dezember 2024") and does not sort reliably.
 */
export function useTimeline(): UseTimelineResult {
  const [state, setState] = useState<TimelineState>({ kind: 'loading' });

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

        const repo = new TimelineEntryRepository();
        const asc = await repo.listChronological(profile.id);
        if (cancelled) return;

        setState({ kind: 'loaded', entries: [...asc].reverse() });
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
