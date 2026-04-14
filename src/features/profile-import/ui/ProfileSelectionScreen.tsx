import { useEffect, useState } from 'react';
import type { Profile } from '../../../domain';
import type { EntityCounts } from '../import';
import { countEntities } from '../import';
import { ProfileRepository } from '../../../db/repositories';
import { ProfileList } from '../../profile-list';
import { ProfileCreateForm } from '../../profile-create';

interface ProfileSelectionScreenProps {
  onSelect: (profileId: string) => void;
  onCancel: () => void;
}

export function ProfileSelectionScreen({ onSelect, onCancel }: ProfileSelectionScreenProps) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [counts, setCounts] = useState<Record<string, EntityCounts>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = new ProfileRepository();
        const list = await repo.list();
        if (cancelled) return;
        setProfiles(list);
        const entries = await Promise.all(
          list.map(async (p) => [p.id, await countEntities(p.id)] as const),
        );
        if (cancelled) return;
        setCounts(Object.fromEntries(entries));
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Profile konnten nicht geladen werden.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (profiles === null) {
    return (
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Profile werden geladen...</p>
      </div>
    );
  }

  const zeroProfiles = profiles.length === 0;

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {zeroProfiles ? 'Profil erstellen' : 'In welches Profil importieren?'}
      </h1>
      {zeroProfiles && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Erstelle zuerst ein Profil, um den Import zu starten.
        </p>
      )}

      {!zeroProfiles && !showCreate && (
        <ProfileList
          profiles={profiles}
          countsByProfile={counts}
          onSelect={onSelect}
          showCreateButton
          onCreateNew={() => setShowCreate(true)}
          selectLabel="Diesem Profil zuordnen"
        />
      )}

      {(zeroProfiles || showCreate) && (
        <div className="mt-2">
          <ProfileCreateForm onComplete={onSelect} />
          {!zeroProfiles && (
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="mt-4 text-sm text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Zurück zur Profilauswahl
            </button>
          )}
        </div>
      )}

      {!zeroProfiles && !showCreate && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}
