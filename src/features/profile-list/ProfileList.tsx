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
   * Label for the select button. Defaults to "Auswählen".
   * Import flow uses "Diesem Profil zuordnen".
   */
  selectLabel?: string;
}

function formatCounts(counts: EntityCounts): string {
  if (countsAreEmpty(counts)) return 'Noch leer';
  const parts: string[] = [];
  if (counts.observations > 0) parts.push(`${counts.observations} Beobachtungen`);
  if (counts.labValues > 0)
    parts.push(`${counts.labReports} Laborbefund${counts.labReports === 1 ? '' : 'e'}`);
  if (counts.supplements > 0) parts.push(`${counts.supplements} Supplemente`);
  if (counts.openPoints > 0) parts.push(`${counts.openPoints} offene Punkte`);
  if (counts.profileVersions > 0) parts.push(`${counts.profileVersions} Versionen`);
  if (counts.timelineEntries > 0) parts.push(`${counts.timelineEntries} Verlaufsnotizen`);
  return parts.join(', ');
}

function profileTypeBadge(profile: Profile): string {
  if (profile.baseData.profileType === 'proxy') {
    const mb = profile.baseData.managedBy?.trim();
    return mb ? `Stellvertretend für ${mb}` : 'Stellvertreterprofil';
  }
  return 'Eigenes Profil';
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
  selectLabel = 'Auswählen',
}: ProfileListProps) {
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
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                aria-current={isSelected ? 'true' : undefined}
                data-testid="profile-card"
              >
                <div>
                  <h3 className="mb-1 text-base font-semibold text-gray-900">
                    {getDisplayName(profile)}
                  </h3>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {profileTypeBadge(profile)}
                  </p>
                  {counts !== undefined && (
                    <p className="mt-2 text-sm text-gray-700">{formatCounts(counts)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(profile.id)}
                  className="self-start rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  {selectLabel}
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
            className="w-full rounded border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 md:w-auto"
          >
            + Neues Profil erstellen
          </button>
        </div>
      )}
    </div>
  );
}
