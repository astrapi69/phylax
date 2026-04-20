import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Profile } from '../../domain';
import { getDisplayName } from '../../domain';
import type { EntityCounts } from '../profile-import/import';
import { countsAreEmpty } from '../profile-import/import';

export interface ProfileListProps {
  profiles: Profile[];
  /**
   * Optional pre-fetched counts per profileId. When present, each card
   * renders a short summary; when absent, the card shows only the name.
   */
  countsByProfile?: Record<string, EntityCounts>;
  onSelect: (profileId: string) => void;
  selectedProfileId?: string;
  showCreateButton?: boolean;
  onCreateNew?: () => void;
  /**
   * Label for the select button. Defaults to the localized "Auswählen".
   * Import flow passes "Diesem Profil zuordnen".
   */
  selectLabel?: string;
}

function formatCounts(t: TFunction<'profile-list'>, counts: EntityCounts): string {
  if (countsAreEmpty(counts)) return t('counts.empty');
  const parts: string[] = [];
  if (counts.observations > 0) parts.push(t('counts.observations', { count: counts.observations }));
  if (counts.labValues > 0) parts.push(t('counts.lab-report', { count: counts.labReports }));
  if (counts.supplements > 0) parts.push(t('counts.supplements', { count: counts.supplements }));
  if (counts.openPoints > 0) parts.push(t('counts.open-points', { count: counts.openPoints }));
  if (counts.profileVersions > 0)
    parts.push(t('counts.versions', { count: counts.profileVersions }));
  if (counts.timelineEntries > 0)
    parts.push(t('counts.timeline-entries', { count: counts.timelineEntries }));
  return parts.join(', ');
}

function profileTypeBadge(t: TFunction<'profile-list'>, profile: Profile): string {
  if (profile.baseData.profileType === 'proxy') {
    const mb = profile.baseData.managedBy?.trim();
    return mb ? t('profile-type.proxy-for', { name: mb }) : t('profile-type.proxy');
  }
  return t('profile-type.own');
}

/**
 * Render a list of profiles as selectable cards.
 *
 * Reusable for the import flow (profile selection) and any future
 * multi-profile switcher. Layout: single column on mobile, grid on
 * md+ when more than one profile exists.
 */
export function ProfileList({
  profiles,
  countsByProfile,
  onSelect,
  selectedProfileId,
  showCreateButton = false,
  onCreateNew,
  selectLabel,
}: ProfileListProps) {
  const { t } = useTranslation('profile-list');
  const resolvedSelectLabel = selectLabel ?? t('action.select');
  return (
    <div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {profiles.map((profile) => {
          const isSelected = profile.id === selectedProfileId;
          const counts = countsByProfile?.[profile.id];
          return (
            <li key={profile.id}>
              <div
                className={`flex h-full flex-col justify-between gap-3 rounded border p-4 transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'
                }`}
                aria-current={isSelected ? 'true' : undefined}
                data-testid="profile-card"
              >
                <div>
                  <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                    {getDisplayName(profile)}
                  </h3>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {profileTypeBadge(t, profile)}
                  </p>
                  {counts !== undefined && (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {formatCounts(t, counts)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(profile.id)}
                  className="self-start rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  {resolvedSelectLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {showCreateButton && onCreateNew && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onCreateNew}
            className="w-full rounded border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800 md:w-auto"
          >
            {t('action.create-new')}
          </button>
        </div>
      )}
    </div>
  );
}
