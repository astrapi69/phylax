import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonDE from '../locales/de/common.json';
import onboardingDE from '../locales/de/onboarding.json';
import unlockDE from '../locales/de/unlock.json';
import profileViewDE from '../locales/de/profile-view.json';
import profileListDE from '../locales/de/profile-list.json';
import profileCreateDE from '../locales/de/profile-create.json';
import observationsDE from '../locales/de/observations.json';
import labValuesDE from '../locales/de/lab-values.json';
import supplementsDE from '../locales/de/supplements.json';
import openPointsDE from '../locales/de/open-points.json';
import timelineDE from '../locales/de/timeline.json';
import importDE from '../locales/de/import.json';
import aiChatDE from '../locales/de/ai-chat.json';
import aiConfigDE from '../locales/de/ai-config.json';
import donationDE from '../locales/de/donation.json';
import settingsDE from '../locales/de/settings.json';
import exportDE from '../locales/de/export.json';
import errorsDE from '../locales/de/errors.json';
import appShellDE from '../locales/de/app-shell.json';
import themeDE from '../locales/de/theme.json';
import pwaUpdateDE from '../locales/de/pwa-update.json';
import documentsDE from '../locales/de/documents.json';
import notFoundDE from '../locales/de/not-found.json';
import backupImportDE from '../locales/de/backup-import.json';

import commonEN from '../locales/en/common.json';
import onboardingEN from '../locales/en/onboarding.json';
import unlockEN from '../locales/en/unlock.json';
import settingsEN from '../locales/en/settings.json';
import appShellEN from '../locales/en/app-shell.json';
import themeEN from '../locales/en/theme.json';
import pwaUpdateEN from '../locales/en/pwa-update.json';
import documentsEN from '../locales/en/documents.json';
import notFoundEN from '../locales/en/not-found.json';
import backupImportEN from '../locales/en/backup-import.json';
import observationsEN from '../locales/en/observations.json';
import labValuesEN from '../locales/en/lab-values.json';
import supplementsEN from '../locales/en/supplements.json';
import openPointsEN from '../locales/en/open-points.json';
import timelineEN from '../locales/en/timeline.json';
import profileViewEN from '../locales/en/profile-view.json';
import profileListEN from '../locales/en/profile-list.json';
import profileCreateEN from '../locales/en/profile-create.json';
import exportEN from '../locales/en/export.json';
import aiConfigEN from '../locales/en/ai-config.json';
import donationEN from '../locales/en/donation.json';
import importEN from '../locales/en/import.json';
import aiChatEN from '../locales/en/ai-chat.json';

/**
 * Namespace identifiers. Keep this list in sync with the JSON imports
 * above. The `as const` preserves the literal union for typed `t()` calls
 * once the typed wrapper lands in a later I18N task.
 */
export const NAMESPACES = [
  'common',
  'onboarding',
  'unlock',
  'profile-view',
  'profile-list',
  'profile-create',
  'observations',
  'lab-values',
  'supplements',
  'open-points',
  'timeline',
  'import',
  'ai-chat',
  'ai-config',
  'donation',
  'settings',
  'export',
  'errors',
  'app-shell',
  'theme',
  'pwa-update',
  'documents',
  'not-found',
  'backup-import',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/**
 * Languages i18next can render. EN joined the list in I18N-02-a so EN
 * resources can load and `getFixedT('en', ...)` works for tests. The
 * user-facing switcher stays hidden via `LANGUAGE_SWITCHER_ENABLED`
 * until I18N-02-e flips it and introduces LanguageSection.
 */
export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;

/**
 * User-facing language-switcher gate. False through I18N-02-a..02-d
 * while EN resources are being populated; I18N-02-e flips this to true
 * alongside the detector activation and LanguageSection component.
 */
export const LANGUAGE_SWITCHER_ENABLED = false;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Synchronous i18next initialization.
 *
 * Resources are imported statically so every namespace is available on the
 * first render; no async loading, no Suspense fallback. I18N-01 ships
 * German only; the app hardcodes `lng: 'de'` to keep bundle size down.
 * When I18N-02 adds English, this config will add
 * `i18next-browser-languagedetector` back so the stored preference
 * (localStorage key `phylax-language`) and the browser-language header
 * drive initial language selection.
 */
void i18n.use(initReactI18next).init({
  resources: {
    de: {
      common: commonDE,
      onboarding: onboardingDE,
      unlock: unlockDE,
      'profile-view': profileViewDE,
      'profile-list': profileListDE,
      'profile-create': profileCreateDE,
      observations: observationsDE,
      'lab-values': labValuesDE,
      supplements: supplementsDE,
      'open-points': openPointsDE,
      timeline: timelineDE,
      import: importDE,
      'ai-chat': aiChatDE,
      'ai-config': aiConfigDE,
      donation: donationDE,
      settings: settingsDE,
      export: exportDE,
      errors: errorsDE,
      'app-shell': appShellDE,
      theme: themeDE,
      'pwa-update': pwaUpdateDE,
      documents: documentsDE,
      'not-found': notFoundDE,
      'backup-import': backupImportDE,
    },
    en: {
      common: commonEN,
      onboarding: onboardingEN,
      unlock: unlockEN,
      settings: settingsEN,
      'app-shell': appShellEN,
      theme: themeEN,
      'pwa-update': pwaUpdateEN,
      documents: documentsEN,
      'not-found': notFoundEN,
      'backup-import': backupImportEN,
      observations: observationsEN,
      'lab-values': labValuesEN,
      supplements: supplementsEN,
      'open-points': openPointsEN,
      timeline: timelineEN,
      'profile-view': profileViewEN,
      'profile-list': profileListEN,
      'profile-create': profileCreateEN,
      export: exportEN,
      'ai-config': aiConfigEN,
      donation: donationEN,
      import: importEN,
      'ai-chat': aiChatEN,
    },
  },
  lng: 'de',
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  fallbackLng: 'de',
  defaultNS: 'common',
  ns: NAMESPACES as unknown as string[],
  interpolation: {
    // React already escapes by default; let it do that job.
    escapeValue: false,
  },
  react: {
    // Synchronous resources means React Suspense is not needed.
    useSuspense: false,
  },
});

export default i18n;
