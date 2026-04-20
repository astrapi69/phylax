import type { TFunction } from 'i18next';
import type { ProfileDiff } from './computeDiff';

/**
 * Build a human-readable German description of the changes in a diff,
 * suitable as the default value for the version-entry input in the
 * preview modal. The user can override this string before committing.
 *
 * Shape:
 *   "KI-Update: [theme] neu, [theme] aktualisiert, N Supplement(e), N Punkt(e)"
 * Parts with zero count are omitted. Empty diff produces "KI-Update: keine
 * Aenderungen".
 */
export function buildVersionDescription(t: TFunction<'ai-chat'>, diff: ProfileDiff): string {
  const parts: string[] = [];

  for (const obs of diff.observations.new) {
    parts.push(t('version-description.theme-new', { theme: obs.theme.trim() }));
  }
  for (const change of diff.observations.changed) {
    parts.push(t('version-description.theme-updated', { theme: change.existing.theme.trim() }));
  }

  const newSupp = diff.supplements.new.length;
  const changedSupp = diff.supplements.changed.length;
  const totalSupp = newSupp + changedSupp;
  if (totalSupp > 0) {
    parts.push(t('version-description.supp', { count: totalSupp }));
  }

  const pts = diff.openPoints.new.length;
  if (pts > 0) {
    parts.push(t('version-description.pt', { count: pts }));
  }

  if (parts.length === 0) {
    return t('version-description.empty');
  }
  return t('version-description.prefix', { parts: parts.join(', ') });
}
