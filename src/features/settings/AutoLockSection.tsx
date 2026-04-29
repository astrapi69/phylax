import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readAppSettings, saveAppSettings } from '../../db/appSettings';
import { DEFAULT_SETTINGS } from '../../db/settings';

const PRESETS: readonly number[] = [1, 5, 15, 30, 60] as const;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Settings section for the auto-lock-after-inactivity timeout.
 *
 * Five preset buttons (1 / 5 / 15 / 30 / 60 minutes) cover the
 * MIN_AUTO_LOCK_MINUTES..MAX_AUTO_LOCK_MINUTES range that
 * `clampAutoLockMinutes` enforces on write. Preset buttons (vs a
 * raw number input) eliminate validation surface, render
 * predictably on mobile, and mirror the radio-style chrome of
 * ThemeSection / LanguageSection.
 *
 * P-05 apply-on-reload semantic: clicking a preset writes the
 * new value to the encrypted MetaPayload via `saveAppSettings`,
 * but the running session keeps using whatever `useAutoLock` was
 * mounted with. The user sees a "Wirksam beim nächsten
 * Entsperren" hint underneath. Live-update across the same
 * session would require an event emitter on the saver +
 * subscription in `useAutoLock`; deferred per Q-lock until a
 * real complaint surfaces.
 *
 * Save errors stay inline within the section (matches the
 * modal-first error-display pattern: errors don't dismiss the
 * surface that triggered them).
 */
export function AutoLockSection() {
  const { t } = useTranslation('settings');
  const [selected, setSelected] = useState<number>(DEFAULT_SETTINGS.autoLockMinutes);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readAppSettings()
      .then((settings) => {
        if (!cancelled) setSelected(settings.autoLockMinutes);
      })
      .catch(() => {
        // Pre-onboarding mount or transient decrypt error: keep default
        // and let the next render-cycle retry on user interaction.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSelect(minutes: number): Promise<void> {
    if (minutes === selected) return;
    setStatus('saving');
    setError(null);
    try {
      await saveAppSettings({ autoLockMinutes: minutes });
      setSelected(minutes);
      setStatus('saved');
    } catch (err) {
      console.error('[AutoLockSection]', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setStatus('error');
    }
  }

  return (
    <section aria-labelledby="auto-lock-section-heading">
      <h2
        id="auto-lock-section-heading"
        className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('auto-lock.heading')}
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        {t('auto-lock.description')}
      </p>
      <fieldset>
        <legend className="sr-only">{t('auto-lock.legend')}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="auto-lock-section-heading">
          {PRESETS.map((minutes) => {
            const isSelected = minutes === selected;
            return (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => void handleSelect(minutes)}
                disabled={status === 'saving'}
                data-testid={`auto-lock-preset-${minutes}`}
                className={
                  isSelected
                    ? 'flex min-h-[44px] min-w-[64px] items-center justify-center rounded-sm border border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'flex min-h-[44px] min-w-[64px] items-center justify-center rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                }
              >
                {t('auto-lock.preset-label', { count: minutes })}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-xs text-gray-500 dark:text-gray-400"
        data-testid="auto-lock-apply-hint"
      >
        {t('auto-lock.applies-on-reload')}
      </p>
      {error && (
        <p
          role="alert"
          data-testid="auto-lock-error"
          className="mt-2 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {t('auto-lock.save-error', { detail: error })}
        </p>
      )}
    </section>
  );
}
