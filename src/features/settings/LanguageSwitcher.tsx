import { useTranslation } from 'react-i18next';
import { LANGUAGE_SWITCHER_ENABLED, SUPPORTED_LANGUAGES } from '../../i18n';

const LANGUAGE_LABEL: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  el: 'Ελληνικά',
};

/**
 * Settings control for switching UI language. Gated on
 * `LANGUAGE_SWITCHER_ENABLED` (false through I18N-02-d, flipped true in
 * I18N-02-e alongside the detector + LanguageSection). Staged rollout
 * keeps the app DE-only from the user's perspective while EN resources
 * land namespace-by-namespace.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('settings');

  if (!LANGUAGE_SWITCHER_ENABLED) {
    return null;
  }

  return (
    <div>
      <label
        htmlFor="language-switcher"
        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {t('language.label')}
      </label>
      <select
        id="language-switcher"
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_LABEL[lang] ?? lang.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
