import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('import');
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [counts, setCounts] = useState<Record<string, EntityCounts>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

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
        if (!cancelled) {
          const detail = err instanceof Error ? err.message : 'Unbekannter Fehler';
          console.error('[ProfileSelectionScreen]', detail);
          setLoadFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadFailed) {
    return (
      <div>
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {t('selection.error.load-failed')}
        </p>
      </div>
    );
  }

  if (profiles === null) {
    return (
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('selection.loading')}</p>
      </div>
    );
  }

  const zeroProfiles = profiles.length === 0;

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {zeroProfiles ? t('selection.heading.zero-profiles') : t('selection.heading.choose')}
      </h1>
      {zeroProfiles && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t('selection.intro-zero')}</p>
      )}

      {!zeroProfiles && !showCreate && (
        <ProfileList
          profiles={profiles}
          countsByProfile={counts}
          onSelect={onSelect}
          showCreateButton
          onCreateNew={() => setShowCreate(true)}
          selectLabel={t('selection.select-label')}
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
              {t('selection.back-to-list')}
            </button>
          )}
        </div>
      )}

      {!zeroProfiles && !showCreate && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('common:action.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
