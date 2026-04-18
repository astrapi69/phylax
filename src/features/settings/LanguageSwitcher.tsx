import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';

const LANGUAGE_LABEL: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  el: 'Ελληνικά',
};

/**
 * Settings control for switching UI language. Renders nothing while only
 * one language is supported; the moment a second language lands (I18N-02
 * English, P-11 others), this component starts rendering the select
 * automatically without any callsite change.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  if (SUPPORTED_LANGUAGES.length < 2) {
    return null;
  }

  return (
    <div>
      <label
        htmlFor="language-switcher"
        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Sprache
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
