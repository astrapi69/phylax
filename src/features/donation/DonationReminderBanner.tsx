import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileVersionRepository } from '../../db/repositories';
import { DonateLink } from './DonateLink';
import { readDonationState, writeDonationState } from './donationStorage';
import { shouldShowReminder } from './shouldShowReminder';

interface DonationReminderBannerProps {
  profileId: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Periodic donation reminder (S-03). Mounted on ProfileView, hidden
 * unless all of shouldShowReminder's conditions pass on mount.
 *
 * Mutually exclusive with the S-02 onboarding card: the `onboardingSeen`
 * gate inside shouldShowReminder ensures the two banners never show
 * simultaneously.
 *
 * The banner is intentionally non-essential: repository errors (locked
 * key store, race conditions) silently suppress rendering rather than
 * bubble up. A nag-prevention feature must never generate user-visible
 * errors of its own.
 */
export function DonationReminderBanner({ profileId }: DonationReminderBannerProps) {
  const { t } = useTranslation('donation');
  const [firstVersionDate, setFirstVersionDate] = useState<Date | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const versions = await new ProfileVersionRepository().listByProfileNewestFirst(profileId);
        if (cancelled) return;
        // listByProfileNewestFirst returns newest first; the oldest is
        // the tail, which is the "first ProfileVersion" we need.
        const oldest = versions[versions.length - 1] ?? null;
        const firstDate = oldest ? new Date(oldest.changeDate) : null;
        setFirstVersionDate(firstDate);
        setVisible(shouldShowReminder(firstDate, readDonationState()));
      } catch {
        // Silent: banner is optional, never generates an error message.
        if (!cancelled) setVisible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (!visible || !firstVersionDate) return null;

  const months = monthsSince(firstVersionDate);

  function recordAndHide(action: 'donated' | 'dismissed') {
    writeDonationState({
      lastReminderAction: action,
      lastReminderDate: todayIso(),
    });
    setVisible(false);
  }

  return (
    <section
      aria-label={t('reminder-banner.aria-label')}
      data-testid="donation-reminder-banner"
      className="flex items-start gap-3 rounded-sm border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/60"
    >
      <p className="flex-1 text-gray-700 dark:text-gray-300">
        {t('reminder-banner.text', { count: months })}
      </p>
      <div className="flex items-center gap-2">
        <DonateLink variant="subtle" onBeforeNavigate={() => recordAndHide('donated')}>
          {t('reminder-banner.support-button')}
        </DonateLink>
        <button
          type="button"
          onClick={() => recordAndHide('dismissed')}
          className="rounded-sm border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {t('reminder-banner.not-now-button')}
        </button>
        <button
          type="button"
          onClick={() => recordAndHide('dismissed')}
          aria-label={t('common:action.close')}
          className="rounded-sm px-2 text-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          &times;
        </button>
      </div>
    </section>
  );
}

function monthsSince(from: Date, now: Date = new Date()): number {
  const days = Math.floor((now.getTime() - from.getTime()) / ONE_DAY_MS);
  return Math.floor(days / 30);
}

function todayIso(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
