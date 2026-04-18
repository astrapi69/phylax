import { DonateLink } from './DonateLink';
import { writeDonationState } from './donationStorage';

interface DonationOnboardingCardProps {
  /**
   * Called after either button is clicked. Parent hides the card
   * immediately (local state); the storage flag persists the decision
   * across sessions via writeDonationState, which this component calls
   * internally before invoking onDismiss.
   */
  onDismiss: () => void;
}

/**
 * One-time welcome card shown on ProfileView when the user has not yet
 * seen the donation onboarding hint. Both actions set `onboardingSeen`
 * in localStorage so the card never reappears.
 *
 * Order of operations for "Projekt unterstuetzen":
 *   1. onBeforeNavigate fires synchronously (storage flip)
 *   2. onDismiss fires via the same click handler (React state flip)
 *   3. Browser follows the link into a new tab
 *
 * That order means the user returns to a view where the card is already
 * hidden, even if they close the new tab without scrolling around.
 */
export function DonationOnboardingCard({ onDismiss }: DonationOnboardingCardProps) {
  function markSeenAndDismiss() {
    writeDonationState({ onboardingSeen: true });
    onDismiss();
  }

  return (
    <section
      aria-labelledby="donation-onboarding-heading"
      data-testid="donation-onboarding-card"
      className="rounded border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/60"
    >
      <h2
        id="donation-onboarding-heading"
        className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        Willkommen bei Phylax
      </h2>
      <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
        Phylax ist ein Open-Source-Projekt eines einzelnen Entwicklers. Keine Cloud, kein Tracking,
        keine Werbung.
      </p>
      <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
        Wenn dir Phylax hilft und du das Projekt unterstuetzen moechtest:
      </p>
      <div className="mb-3 flex flex-wrap gap-3">
        <DonateLink variant="primary" onBeforeNavigate={markSeenAndDismiss}>
          Projekt unterstuetzen
        </DonateLink>
        <button
          type="button"
          onClick={markSeenAndDismiss}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Verstanden
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Du findest diesen Hinweis jederzeit in den Einstellungen.
      </p>
    </section>
  );
}
