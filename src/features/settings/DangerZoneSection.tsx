import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResetDialog } from '../reset';

/**
 * Settings danger zone. Hosts the full-data reset trigger. Renders
 * the trigger button by default; opens the inline `ResetDialog`
 * when clicked.
 *
 * Conventionally placed last in the settings layout so users do not
 * see it on first-click. The trigger button uses red-outline
 * styling consistent with D-08's delete document button - destructive
 * intent visible without overstating the action's frequency.
 */
export function DangerZoneSection() {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="danger-zone-heading" className="space-y-3">
      <h2
        id="danger-zone-heading"
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('danger-zone.heading')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('danger-zone.description')}</p>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-700 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-900/30"
          data-testid="danger-zone-reset-btn"
        >
          {t('danger-zone.reset-button')}
        </button>
      )}
      {open && <ResetDialog onCancel={() => setOpen(false)} />}
    </section>
  );
}
