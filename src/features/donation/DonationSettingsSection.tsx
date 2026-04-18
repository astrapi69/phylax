import { DonateLink } from './DonateLink';

/**
 * Always-visible "Phylax unterstuetzen" section on the Settings screen.
 *
 * S-01 is state-less: this section never stores or reads any flag. The
 * settings entry is a permanent, low-friction way to find the donation
 * page, so users who dismissed the onboarding hint or the reminder
 * banner can still come back here on their own schedule.
 */
export function DonationSettingsSection() {
  return (
    <section aria-labelledby="donation-section-heading">
      <h2
        id="donation-section-heading"
        className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        Phylax unterstuetzen
      </h2>
      <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
        Phylax wird als Open-Source-Projekt ohne Tracking, ohne Cloud und ohne Werbung entwickelt.
        Wenn dir die App hilft und du das Projekt unterstuetzen moechtest, findest du alle
        Spenden-Moeglichkeiten unter dem Link unten.
      </p>
      <DonateLink>Projekt unterstuetzen</DonateLink>
    </section>
  );
}
