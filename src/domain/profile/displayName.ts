import type { TFunction } from 'i18next';
import i18n from '../../i18n/config';
import type { Profile } from './types';

/**
 * Resolve a user-facing display name for a profile.
 *
 * When `baseData.name` is set and non-empty, it wins. Otherwise a
 * type-aware fallback keeps the UI meaningful for legacy profiles
 * created before the name field existed:
 *
 * - `self`  -> common:entity.fallback-self
 * - `proxy` -> common:entity.fallback-proxy-for (with managedBy)
 *              or common:entity.fallback-proxy (without)
 *
 * All consumers should route through this helper so that naming
 * conventions change in exactly one place.
 *
 * The `t` parameter is optional; when omitted the helper falls back to
 * the initialized i18n instance. Callers inside React components
 * should pass their own `t` so the function participates in the render
 * cycle on language change.
 */
export function getDisplayName(
  profile: Pick<Profile, 'baseData'>,
  t: TFunction = i18n.t.bind(i18n),
): string {
  const { name, profileType, managedBy } = profile.baseData;
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  if (profileType === 'proxy') {
    const trimmedManagedBy = managedBy?.trim();
    return trimmedManagedBy
      ? t('common:entity.fallback-proxy-for', { name: trimmedManagedBy })
      : t('common:entity.fallback-proxy');
  }
  return t('common:entity.fallback-self');
}
