import type { Profile } from './types';

/**
 * Resolve a user-facing display name for a profile.
 *
 * When `baseData.name` is set and non-empty, it wins. Otherwise a
 * type-aware fallback keeps the UI meaningful for legacy profiles
 * created before the name field existed:
 *
 * - `self`  -> "Mein Profil"
 * - `proxy` -> "Profil von {managedBy}" if managedBy is set,
 *              otherwise "Stellvertreterprofil"
 *
 * All consumers should route through this helper so that naming
 * conventions change in exactly one place.
 */
export function getDisplayName(profile: Pick<Profile, 'baseData'>): string {
  const { name, profileType, managedBy } = profile.baseData;
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  if (profileType === 'proxy') {
    const trimmedManagedBy = managedBy?.trim();
    return trimmedManagedBy ? `Profil von ${trimmedManagedBy}` : 'Stellvertreterprofil';
  }
  return 'Mein Profil';
}
