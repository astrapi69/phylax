import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import type { Theme } from '../theme';

/**
 * Radio group for the three theme states. Lives on the settings screen;
 * the header has a quick-cycle toggle for the same state.
 */
export function ThemeSection() {
  const { t } = useTranslation('settings');
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: Theme; label: string; description?: string }> = [
    { value: 'light', label: t('theme.options.light') },
    { value: 'dark', label: t('theme.options.dark') },
    {
      value: 'auto',
      label: t('theme.options.auto'),
      description: t('theme.options.auto-description'),
    },
  ];

  return (
    <section aria-labelledby="theme-section-heading">
      <h2
        id="theme-section-heading"
        className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('theme.heading')}
      </h2>
      <fieldset>
        <legend className="sr-only">{t('theme.legend')}</legend>
        <div className="space-y-2">
          {options.map((option) => {
            const id = `theme-option-${option.value}`;
            return (
              <div key={option.value}>
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
                  <input
                    id={id}
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={theme === option.value}
                    onChange={() => setTheme(option.value)}
                    className="mt-1 h-4 w-4 accent-blue-600"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {option.description}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
