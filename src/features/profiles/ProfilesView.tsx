import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Profile } from '../../domain';
import { ProfileRepository } from '../../db/repositories';
import { countEntities, type EntityCounts } from '../profile-import/import';
import { ProfileList } from '../profile-list';
import { useActiveProfile } from '../active-profile';

/**
 * Multi-profile switcher screen (M-01).
 *
 * Lists every profile in the vault as a card via the reusable
 * `<ProfileList>` component. The active profile is highlighted via
 * `selectedProfileId`. Selecting a card flips `activeProfileId` in
 * the ActiveProfileContext and routes back to `/profile`; the feature
 * hooks subscribed to that context (useProfileView, useLabValues,
 * useTimeline, useObservations, useSupplements, useOpenPoints,
 * useDocuments) refetch on the next render.
 *
 * The "+ Neues Profil erstellen" action routes to `/profile/create`
 * which already activates the new profile on submit (M-02 reuses the
 * onboarding form here without any UI fork).
 */
type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; profiles: Profile[]; counts: Record<string, EntityCounts> }
  | { kind: 'error'; detail: string };

export function ProfilesView() {
  const { t } = useTranslation('profile-list');
  const navigate = useNavigate();
  const { activeProfileId, setActiveProfileId } = useActiveProfile();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = new ProfileRepository();
        const profiles = await repo.list();
        if (cancelled) return;
        const counts = Object.fromEntries(
          await Promise.all(profiles.map(async (p) => [p.id, await countEntities(p.id)] as const)),
        ) as Record<string, EntityCounts>;
        if (cancelled) return;
        setState({ kind: 'loaded', profiles, counts });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = useCallback(
    (profileId: string) => {
      setActiveProfileId(profileId);
      navigate('/profile');
    },
    [navigate, setActiveProfileId],
  );

  const handleCreateNew = useCallback(() => {
    navigate('/profile/create');
  }, [navigate]);

  return (
    <section aria-labelledby="profiles-heading" className="space-y-4">
      <header className="space-y-1">
        <h1 id="profiles-heading" className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {t('screen.heading')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('screen.description')}</p>
      </header>

      {state.kind === 'loading' && (
        <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
          {t('common:status.loading', { defaultValue: 'Lade...' })}
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.detail}
        </p>
      )}

      {state.kind === 'loaded' && state.profiles.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('screen.empty')}</p>
      )}

      {state.kind === 'loaded' && state.profiles.length > 0 && (
        <ProfileList
          profiles={state.profiles}
          countsByProfile={state.counts}
          selectedProfileId={activeProfileId ?? undefined}
          onSelect={handleSelect}
          selectLabel={t('action.activate')}
          showCreateButton
          onCreateNew={handleCreateNew}
        />
      )}
    </section>
  );
}
