import { useTranslation } from 'react-i18next';
import { ThemeSection } from './ThemeSection';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AISettingsSection } from '../ai-config';
import { DonationSettingsSection } from '../donation';
import { ExportButton } from '../export';

/**
 * Settings screen. Hosts the theme picker, the AI configuration, the
 * export entry point, and the donation link. Future settings (auto-lock
 * timeout, language, etc.) attach as more sections here.
 */
export function SettingsScreen() {
  const { t } = useTranslation('settings');
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('screen.heading')}</h1>
      <LanguageSwitcher />
      <ThemeSection />
      <AISettingsSection />
      <section aria-labelledby="export-settings-heading">
        <h2
          id="export-settings-heading"
          className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {t('export.heading')}
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('export.description')}</p>
        <ExportButton className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
          {t('export.button')}
        </ExportButton>
      </section>
      <DonationSettingsSection />
    </div>
  );
}
