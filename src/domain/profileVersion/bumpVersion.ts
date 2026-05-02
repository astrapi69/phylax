/**
 * Increment the last numeric component of a dotted version, e.g.
 * 1.3.1 -> 1.3.2 or 1.0 -> 1.1. For anything that is not a dotted
 * number sequence, append or increment a `-aiN` suffix so the version
 * stays monotonically increasing without corrupting the original.
 *
 * Shared between profile-version-creating paths (AI-chat commit,
 * manual base-data edit). Pure function - same input, same output,
 * no side effects.
 *
 * The `-aiN` suffix is a historical fallback for non-dotted versions
 * (added when the AI-chat commit path was the only caller). It
 * remains for behavior equivalence; in practice all profiles use
 * dotted semver and the suffix path is rarely hit.
 */
export function bumpVersion(version: string): string {
  const trimmed = version.trim();
  const dotted = /^(\d+(?:\.\d+)*)\.(\d+)$/.exec(trimmed);
  if (dotted) {
    return `${dotted[1]}.${Number(dotted[2]) + 1}`;
  }
  const aiSuffix = /^(.+)-ai(\d+)$/.exec(trimmed);
  if (aiSuffix) {
    return `${aiSuffix[1]}-ai${Number(aiSuffix[2]) + 1}`;
  }
  return `${trimmed || '0'}-ai1`;
}
