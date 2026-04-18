import { useState } from 'react';
import { getDisplayName } from '../../domain';
import type { Profile } from '../../domain';
import { DonationOnboardingCard, readDonationState } from '../donation';
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
  const { state } = useProfileView();

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
        Profil wird geladen...
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      >
        {state.message}
      </div>
    );
  }

  return <ProfileViewContent profile={state.profile} />;
}

function ProfileViewContent({ profile }: { profile: Profile }) {
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

      <header className="flex flex-col gap-2 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{name}</h1>
          <div className="mt-1">
            <ProfileTypeBadge profileType={baseData.profileType} managedBy={baseData.managedBy} />
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 md:text-right">
          <p>
            Version <span className="font-medium text-gray-900 dark:text-gray-100">v{version}</span>
          </p>
          {lastUpdateReason && (
            <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400 md:ml-auto">
              Letzte Änderung: {lastUpdateReason}
            </p>
          )}
        </div>
      </header>

      <BaseDataSection baseData={baseData} />

      {baseData.primaryDoctor && (
        <section aria-labelledby="hausarzt-heading">
          <h2
            id="hausarzt-heading"
            className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            Hausarzt
          </h2>
          <DoctorCard doctor={baseData.primaryDoctor} />
        </section>
      )}

      {baseData.knownDiagnoses.length > 0 && (
        <BulletSection id="diagnoses" title="Bekannte Diagnosen" items={baseData.knownDiagnoses} />
      )}

      {baseData.currentMedications.length > 0 && (
        <BulletSection
          id="medications"
          title="Aktuelle Medikamente"
          items={baseData.currentMedications}
        />
      )}

      {baseData.relevantLimitations.length > 0 && (
        <BulletSection
          id="limitations"
          title="Relevante Einschränkungen"
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
            Externe Referenzen
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
