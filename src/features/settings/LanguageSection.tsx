import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clearLanguagePreference,
  detectFromNavigator,
  hasLanguagePreference,
  setLanguagePreference,
} from '../../i18n/detector';
import type { SupportedLanguage } from '../../i18n/config';

type Selection = 'auto' | SupportedLanguage;

function initialSelection(currentLang: string): Selection {
  if (!hasLanguagePreference()) return 'auto';
  return currentLang === 'en' ? 'en' : 'de';
}

export function LanguageSection() {
  const { t, i18n } = useTranslation('settings');
  const [selected, setSelected] = useState<Selection>(() => initialSelection(i18n.language));

  useEffect(() => {
    const onChange = () => setSelected(initialSelection(i18n.language));
    i18n.on('languageChanged', onChange);
    return () => {
      i18n.off('languageChanged', onChange);
    };
  }, [i18n]);

  const handleChange = (value: Selection) => {
    setSelected(value);
    if (value === 'auto') {
      clearLanguagePreference();
      void i18n.changeLanguage(detectFromNavigator());
    } else {
      setLanguagePreference(value);
      void i18n.changeLanguage(value);
    }
  };

  return (
    <section aria-labelledby="language-heading">
      <h2
        id="language-heading"
        className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('language.heading')}
      </h2>
      <fieldset>
        <legend className="sr-only">{t('language.heading')}</legend>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="radio"
              name="language"
              value="auto"
              checked={selected === 'auto'}
              onChange={() => handleChange('auto')}
            />
            {t('language.auto')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="radio"
              name="language"
              value="de"
              checked={selected === 'de'}
              onChange={() => handleChange('de')}
            />
            {t('language.option.de')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="radio"
              name="language"
              value="en"
              checked={selected === 'en'}
              onChange={() => handleChange('en')}
            />
            {t('language.option.en')}
          </label>
        </div>
      </fieldset>
    </section>
  );
}
