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
export function buildVersionDescription(diff: ProfileDiff): string {
  const parts: string[] = [];

  for (const obs of diff.observations.new) {
    parts.push(`${obs.theme.trim()} neu`);
  }
  for (const change of diff.observations.changed) {
    parts.push(`${change.existing.theme.trim()} aktualisiert`);
  }

  const newSupp = diff.supplements.new.length;
  const changedSupp = diff.supplements.changed.length;
  const totalSupp = newSupp + changedSupp;
  if (totalSupp > 0) {
    parts.push(`${totalSupp} ${totalSupp === 1 ? 'Supplement' : 'Supplemente'}`);
  }

  const pts = diff.openPoints.new.length;
  if (pts > 0) {
    parts.push(`${pts} ${pts === 1 ? 'Punkt' : 'Punkte'}`);
  }

  if (parts.length === 0) {
    return 'KI-Update: keine Aenderungen';
  }
  return `KI-Update: ${parts.join(', ')}`;
}
