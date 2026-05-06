import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ResetDialog, SoftResetDialog } from '../reset';

type OpenDialog = null | 'soft' | 'hard';

/**
 * Settings danger zone. Hosts two sibling reset triggers:
 *
 * - Soft reset (amber, lower-friction): wipes profile data but keeps the
 *   master password, AI configuration, and user preferences. Closes by
 *   navigating to `/profile/create` so the empty-vault guard does not
 *   bounce the user back to the settings screen with a stale profile
 *   reference.
 * - Hard reset (red, hard-stop): full data wipe + re-onboarding,
 *   unchanged from the pre-soft-reset implementation.
 *
 * The two-button stack (soft above hard) follows the four-Q-lock review
 * recommendation: surface the lower-friction option first while keeping
 * the destructive intent visually distinct (amber outline vs red
 * outline). Triggers hide while either dialog is open to prevent
 * accidental cross-clicks.
 */
export function DangerZoneSection() {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const handleSoftSubmitted = (success: boolean): void => {
    if (success) {
      navigate('/profile/create', { replace: true });
    }
  };

  return (
    <section aria-labelledby="danger-zone-heading" className="space-y-3">
      <h2
        id="danger-zone-heading"
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('danger-zone.heading')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('danger-zone.description')}</p>
      {openDialog === null && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOpenDialog('soft')}
            className="inline-flex min-h-[44px] items-center rounded-md border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-amber-600 dark:bg-gray-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
            data-testid="danger-zone-soft-reset-btn"
          >
            {t('danger-zone.soft-reset-button')}
          </button>
          <button
            type="button"
            onClick={() => setOpenDialog('hard')}
            className="inline-flex min-h-[44px] items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-700 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-900/30"
            data-testid="danger-zone-reset-btn"
          >
            {t('danger-zone.reset-button')}
          </button>
        </div>
      )}
      {openDialog === 'soft' && (
        <SoftResetDialog onCancel={() => setOpenDialog(null)} onSubmitted={handleSoftSubmitted} />
      )}
      {openDialog === 'hard' && <ResetDialog onCancel={() => setOpenDialog(null)} />}
    </section>
  );
}
