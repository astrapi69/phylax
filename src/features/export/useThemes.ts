import { useEffect, useState } from 'react';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';

/**
 * Loads the distinct observation themes for the current profile so the
 * X-04 theme filter in ExportDialog can render its checkbox list.
 *
 * Concern separation from `useExportData`: the export-data load is the
 * last step before generating a file (slow, format-specific). This hook
 * runs on dialog mount so the filter UI can render before the user
 * commits to a format. Sorts alphabetically (German collation) for
 * deterministic UI ordering.
 *
 * No retry, no abort: a profile-load failure quietly yields an empty
 * array. The dialog hides the theme-filter section when there are zero
 * themes, so a failure degrades gracefully without breaking the dialog.
 */
export interface UseThemesResult {
  themes: readonly string[];
  loading: boolean;
}

export function useThemes(): UseThemesResult {
  const [themes, setThemes] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await new ProfileRepository().getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setThemes([]);
          return;
        }
        const result = await new ObservationRepository().listThemes(profile.id);
        if (cancelled) return;
        const collator = new Intl.Collator('de');
        setThemes([...result].sort((a, b) => collator.compare(a, b)));
      } catch {
        if (!cancelled) setThemes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { themes, loading };
}
