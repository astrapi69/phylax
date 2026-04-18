import type { ThemeGroup } from './useObservations';

export type SortMode = 'recent' | 'alphabetical';

/**
 * Outer-level section around `ThemeGroup[]`. The Recent-first sort mode
 * produces up to two sections ("Kuerzlich aktualisiert" + "Alle Themen");
 * the Alphabetical mode produces a single unlabeled section.
 */
export interface ObservationSection {
  /**
   * 'recent' and 'all' trigger a rendered section heading; null means
   * "no heading" (single section covers the whole list).
   */
  label: 'recent' | 'all' | null;
  themeGroups: ThemeGroup[];
}

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reshape theme-grouped observations into display sections.
 *
 * Matching rules for Recent-first mode:
 * - A theme group lands in the Recent section if ANY of its observations
 *   was updated within the last 30 days (`updatedAt >= now - 30d`). This
 *   keeps all of a theme's observations together instead of splitting
 *   them across sections.
 * - Recent groups are ordered by their newest observation's updatedAt,
 *   descending. Same-timestamp ties break alphabetically (German locale).
 * - Non-recent groups sort alphabetically (German locale).
 * - Either section is suppressed when empty. If only one section has
 *   content, its heading is also suppressed (label = null).
 *
 * Alphabetical mode produces a single unlabeled section with all theme
 * groups sorted alphabetically.
 */
export function sortObservations(
  groups: ThemeGroup[],
  mode: SortMode,
  now: Date = new Date(),
): ObservationSection[] {
  if (groups.length === 0) return [];

  const collator = new Intl.Collator('de');

  if (mode === 'alphabetical') {
    const sorted = [...groups].sort((a, b) => collator.compare(a.theme, b.theme));
    return [{ label: null, themeGroups: sorted }];
  }

  const cutoff = now.getTime() - RECENT_WINDOW_MS;
  const recent: ThemeGroup[] = [];
  const older: ThemeGroup[] = [];

  for (const g of groups) {
    if (maxUpdatedAt(g) >= cutoff) {
      recent.push(g);
    } else {
      older.push(g);
    }
  }

  recent.sort((a, b) => {
    const diff = maxUpdatedAt(b) - maxUpdatedAt(a);
    if (diff !== 0) return diff;
    return collator.compare(a.theme, b.theme);
  });
  older.sort((a, b) => collator.compare(a.theme, b.theme));

  if (recent.length === 0) {
    return [{ label: null, themeGroups: older }];
  }
  if (older.length === 0) {
    return [{ label: null, themeGroups: recent }];
  }
  return [
    { label: 'recent', themeGroups: recent },
    { label: 'all', themeGroups: older },
  ];
}

function maxUpdatedAt(group: ThemeGroup): number {
  let max = 0;
  for (const obs of group.observations) {
    if (obs.updatedAt > max) max = obs.updatedAt;
  }
  return max;
}
