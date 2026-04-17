import { useEffect, useState } from 'react';
import type { LabReport, LabValue } from '../../domain';
import { LabReportRepository, LabValueRepository, ProfileRepository } from '../../db/repositories';

export interface LabReportWithValues {
  report: LabReport;
  valuesByCategory: Map<string, LabValue[]>;
}

export type LabValuesState =
  | { kind: 'loading' }
  | { kind: 'loaded'; reports: LabReportWithValues[] }
  | { kind: 'error'; message: string };

export interface UseLabValuesResult {
  state: LabValuesState;
}

/**
 * Load all lab reports and their values for the current profile.
 * Reports are sorted newest-first. Values within each report are
 * grouped by category, preserving insertion order via Map.
 */
export function useLabValues(): UseLabValuesResult {
  const [state, setState] = useState<LabValuesState>({ kind: 'loading' });

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
            message:
              err instanceof Error ? err.message : 'Laborwerte konnten nicht geladen werden.',
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
