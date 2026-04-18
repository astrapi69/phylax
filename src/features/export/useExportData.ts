import { useCallback, useState } from 'react';
import type {
  Profile,
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  TimelineEntry,
} from '../../domain';
import {
  ProfileRepository,
  ObservationRepository,
  LabReportRepository,
  LabValueRepository,
  SupplementRepository,
  OpenPointRepository,
  TimelineEntryRepository,
} from '../../db/repositories';

export interface ExportData {
  profile: Profile;
  observations: Observation[];
  labReports: LabReport[];
  labValues: LabValue[];
  supplements: Supplement[];
  openPoints: OpenPoint[];
  timelineEntries: TimelineEntry[];
}

export type LoadExportDataResult =
  | { kind: 'ok'; data: ExportData }
  | { kind: 'no-profile' }
  | { kind: 'locked' }
  | { kind: 'error'; message: string };

export interface UseExportDataHook {
  loading: boolean;
  loadExportData: () => Promise<LoadExportDataResult>;
}

/**
 * Shared data loader for every export format. Resolves the current
 * profile plus all entity lists in one await, decrypted in memory, and
 * returns a typed Result. No side effects on failure: a locked key
 * store or a missing profile yields the matching Result variant rather
 * than throwing.
 */
export function useExportData(): UseExportDataHook {
  const [loading, setLoading] = useState(false);

  const loadExportData = useCallback(async (): Promise<LoadExportDataResult> => {
    setLoading(true);
    try {
      const profile = await new ProfileRepository().getCurrentProfile();
      if (!profile) return { kind: 'no-profile' };

      const labValueRepo = new LabValueRepository();
      const [observations, labReports, supplements, openPoints, timelineEntries] =
        await Promise.all([
          new ObservationRepository().listByProfile(profile.id),
          new LabReportRepository(labValueRepo).listByProfileDateDescending(profile.id),
          new SupplementRepository().listByProfile(profile.id),
          new OpenPointRepository().listByProfile(profile.id),
          new TimelineEntryRepository().listByProfile(profile.id),
        ]);

      const labValues = (
        await Promise.all(labReports.map((r) => labValueRepo.listByReport(r.id)))
      ).flat();

      return {
        kind: 'ok',
        data: {
          profile,
          observations,
          labReports,
          labValues,
          supplements,
          openPoints,
          timelineEntries,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (message.includes('no key') || message.includes('locked') || message.includes('unlock')) {
        return { kind: 'locked' };
      }
      return { kind: 'error', message: err instanceof Error ? err.message : 'Unbekannter Fehler' };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, loadExportData };
}
