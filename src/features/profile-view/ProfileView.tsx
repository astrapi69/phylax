import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDisplayName } from '../../domain';
import type { Profile } from '../../domain';
import { DonationOnboardingCard, DonationReminderBanner, readDonationState } from '../donation';
import { ExportButton } from '../export';
import { ImportProfileLinkButton } from '../profile-import/ui';
import { BaseDataSection, ProfileTypeBadge } from './BaseDataSection';
import { DoctorCard } from './DoctorCard';
import { WarningSignsSection } from './WarningSignsSection';
import { useProfileView } from './useProfileView';

/**
 * Read-only overview of the current profile. Landing page after login.
 *
 * Empty sections are hidden rather than shown with placeholders. A
 * profile with no diagnoses simply has no "Bekannte Diagnosen" heading.
 */
export function ProfileView() {
  const { t } = useTranslation('profile-view');
  const { state } = useProfileView();

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
        {t('loading')}
      </div>
    );
  }

  if (state.kind === 'error') {
    if (state.error.kind === 'generic') {
      // Repository detail stays in logs; users see the translated fallback.
      console.error('[ProfileView]', state.error.detail);
    }
    const message =
      state.error.kind === 'not-found' ? t('common:error.no-profile') : t('error.load-failed');
    return (
      <div
        role="alert"
        className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      >
        {message}
      </div>
    );
  }

  return <ProfileViewContent profile={state.profile} />;
}

function ProfileViewContent({ profile }: { profile: Profile }) {
  const { t } = useTranslation('profile-view');
  const { baseData, warningSigns, externalReferences, version, lastUpdateReason } = profile;
  const name = getDisplayName(profile);

  // One-time donation hint (S-02). Hidden on mount if the user already
  // dismissed it in any previous session; otherwise flips to hidden the
  // moment the user clicks either action on the card.
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => !readDonationState().onboardingSeen,
  );

  return (
    <article className="space-y-6">
      {showOnboarding && <DonationOnboardingCard onDismiss={() => setShowOnboarding(false)} />}
      <DonationReminderBanner profileId={profile.id} />

      <header className="flex flex-col gap-2 border-b border-gray-200 pb-4 md:flex-row md:items-start md:justify-between dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{name}</h1>
          <div className="mt-1">
            <ProfileTypeBadge profileType={baseData.profileType} managedBy={baseData.managedBy} />
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 text-sm text-gray-600 md:items-end md:text-right dark:text-gray-400">
          <div className="flex flex-wrap gap-2">
            <ImportProfileLinkButton />
            <ExportButton />
          </div>
          <div>
            <p>
              {t('header.version-label')}{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">v{version}</span>
            </p>
            {lastUpdateReason && (
              <p className="mt-1 max-w-xs text-xs text-gray-500 md:ml-auto dark:text-gray-400">
                {t('header.last-change', { reason: lastUpdateReason })}
              </p>
            )}
          </div>
        </div>
      </header>

      <BaseDataSection baseData={baseData} />

      {baseData.primaryDoctor && (
        <section aria-labelledby="hausarzt-heading">
          <h2
            id="hausarzt-heading"
            className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('section.doctor')}
          </h2>
          <DoctorCard doctor={baseData.primaryDoctor} />
        </section>
      )}

      {baseData.knownDiagnoses.length > 0 && (
        <BulletSection
          id="diagnoses"
          title={t('section.diagnoses')}
          items={baseData.knownDiagnoses}
        />
      )}

      {baseData.currentMedications.length > 0 && (
        <BulletSection
          id="medications"
          title={t('section.medications')}
          items={baseData.currentMedications}
        />
      )}

      {baseData.relevantLimitations.length > 0 && (
        <BulletSection
          id="limitations"
          title={t('section.limitations')}
          items={baseData.relevantLimitations}
        />
      )}

      <WarningSignsSection signs={warningSigns} />

      {externalReferences.length > 0 && (
        <section aria-labelledby="refs-heading">
          <h2
            id="refs-heading"
            className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('section.references')}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
            {externalReferences.map((ref, i) => (
              <li key={i}>{renderReference(ref)}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function BulletSection({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2
        id={`${id}-heading`}
        className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {title}
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function renderReference(ref: string): React.ReactNode {
  if (/^https?:\/\//i.test(ref)) {
    return (
      <a
        href={ref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {ref}
      </a>
    );
  }
  return ref;
}
