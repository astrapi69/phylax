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
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/**
 * Supported UI languages. German is the only active language for I18N-01.
 * Additional languages (I18N-02 English, P-11 Spanish/French/Greek) extend
 * this list and add resources below.
 */
export const SUPPORTED_LANGUAGES = ['de'] as const;

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
