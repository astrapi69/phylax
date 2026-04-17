import type { DetectedFragment } from './detectProfileFragment';

const SKELETON_HEADER = '# Profil: AI-Fragment';

/**
 * Wrap a DetectedFragment into a minimal profile skeleton that the
 * existing IM-01 parser (`parseProfile`) can read. The parser expects a
 * top-level `# Profil:` line plus named level-2 sections; observations
 * live inside `## Beobachtungen`, lab/supplement/open-point sections are
 * passed through as-is.
 *
 * Sections absent from the fragment are simply not emitted. The output
 * is guaranteed to be parseable when at least one of the four hasXxx
 * flags on the fragment is true.
 */
export function wrapFragmentForParser(fragment: DetectedFragment): string {
  const parts: string[] = [SKELETON_HEADER, ''];

  if (fragment.observationBlocks.length > 0) {
    parts.push('## Beobachtungen');
    parts.push('');
    parts.push(fragment.observationBlocks.join('\n\n'));
    parts.push('');
  }

  if (fragment.supplementsBlock) {
    parts.push(fragment.supplementsBlock);
    parts.push('');
  }
  if (fragment.openPointsBlock) {
    parts.push(fragment.openPointsBlock);
    parts.push('');
  }

  return parts.join('\n').trimEnd() + '\n';
}
