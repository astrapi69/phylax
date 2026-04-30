import { useTranslation } from 'react-i18next';
import { ThemeSection } from './ThemeSection';
import { LanguageSection } from './LanguageSection';
import { AutoLockSection } from './AutoLockSection';
import { ChangePasswordSection } from './ChangePasswordSection';
import { DangerZoneSection } from './DangerZoneSection';
import { AISettingsSection } from '../ai-config';
import { DonationSettingsSection } from '../donation';
import { ExportButton } from '../export';
import { BackupExportSection } from '../backup-export';
import { BackupImportSection } from '../backup-import';
import { LegalSection } from '../legal';

/**
 * Settings screen. Hosts the theme picker, the language switcher, the
 * AI configuration, data-management actions (profile export, backup
 * export), and the donation link. Chrome-level settings (theme +
 * language) come first; feature-level settings follow; data-lifecycle
 * actions grouped under a dedicated heading.
 */
export function SettingsScreen() {
  const { t } = useTranslation('settings');
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('screen.heading')}</h1>
      <ThemeSection />
      <LanguageSection />
      <AutoLockSection />
      <ChangePasswordSection />
      <AISettingsSection />
      <section aria-labelledby="data-management-heading" className="space-y-6">
        <h2
          id="data-management-heading"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {t('data-management.heading')}
        </h2>
        <section aria-labelledby="export-settings-heading">
          <h3
            id="export-settings-heading"
            className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('export.heading')}
          </h3>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('export.description')}</p>
          <ExportButton className="rounded-sm border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
            {t('export.button')}
          </ExportButton>
        </section>
        <BackupExportSection />
        <BackupImportSection />
      </section>
      <DonationSettingsSection />
      <LegalSection />
      <DangerZoneSection />
    </div>
  );
}
