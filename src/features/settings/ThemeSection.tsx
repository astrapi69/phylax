import { useTheme } from '../theme';
import type { Theme } from '../theme';

const OPTIONS: Array<{ value: Theme; label: string; description?: string }> = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  {
    value: 'auto',
    label: 'System folgen',
    description: 'Folgt den Einstellungen deines Geräts.',
  },
];

/**
 * Radio group for the three theme states. Lives on the settings screen;
 * the header has a quick-cycle toggle for the same state.
 */
export function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <section aria-labelledby="theme-section-heading">
      <h2
        id="theme-section-heading"
        className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        Darstellung
      </h2>
      <fieldset>
        <legend className="sr-only">Theme auswählen</legend>
        <div className="space-y-2">
          {OPTIONS.map((option) => {
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
