import { useCallback, useEffect, useState } from 'react';
import type { LabReport, LabValue } from '../../domain';
import { LabReportRepository, LabValueRepository, ProfileRepository } from '../../db/repositories';

export interface LabReportWithValues {
  report: LabReport;
  valuesByCategory: Map<string, LabValue[]>;
}

export type LabValuesError = { kind: 'no-profile' } | { kind: 'generic'; detail: string };

export type LabValuesState =
  | { kind: 'loading' }
  | { kind: 'loaded'; reports: LabReportWithValues[] }
  | { kind: 'error'; error: LabValuesError };

export interface UseLabValuesResult {
  state: LabValuesState;
  /**
   * Re-run the load. Used by O-12a form/delete success paths to refresh
   * the list without a full route navigation. Direct call (not pub/sub)
   * for traceability — mirrors the O-10 pattern on `useObservations`.
   */
  refetch: () => void;
}

/**
 * Load all lab reports and their values for the current profile.
 * Reports are sorted newest-first. Values within each report are
 * grouped by category, preserving insertion order via Map.
 */
export function useLabValues(): UseLabValuesResult {
  const [state, setState] = useState<LabValuesState>({ kind: 'loading' });
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

        const reportRepo = new LabReportRepository(new LabValueRepository());
        const reports = await reportRepo.listByProfileDateDescending(profile.id);
        if (cancelled) return;

        const valueRepo = new LabValueRepository();
        const enriched: LabReportWithValues[] = await Promise.all(
          reports.map(async (report) => {
            const values = await valueRepo.listByReport(report.id);
            return { report, valuesByCategory: groupByCategory(values) };
          }),
        );
        if (cancelled) return;

        setState({ kind: 'loaded', reports: enriched });
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

function groupByCategory(values: LabValue[]): Map<string, LabValue[]> {
  const map = new Map<string, LabValue[]>();
  for (const v of values) {
    const existing = map.get(v.category);
    if (existing) {
      existing.push(v);
    } else {
      map.set(v.category, [v]);
    }
  }
  return map;
}
