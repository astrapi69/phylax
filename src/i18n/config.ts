import i18n, { type BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectInitialLanguage } from './detector';

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
import documentsDE from '../locales/de/documents.json';
import notFoundDE from '../locales/de/not-found.json';
import backupImportDE from '../locales/de/backup-import.json';
import backupExportDE from '../locales/de/backup-export.json';
import resetDE from '../locales/de/reset.json';
import documentImportDE from '../locales/de/document-import.json';
import legalDE from '../locales/de/legal.json';

/**
 * Lazy-loaded EN locale resources. `import.meta.glob` (without
 * `eager: true`) emits one chunk per matching file at build time;
 * each chunk is fetched on demand via the i18next backend below.
 *
 * Result: EN namespaces stay out of the main JS bundle. DE users
 * (the primary market per CLAUDE.md) never download EN strings.
 * EN users pay one parallel-fetch round-trip on first paint
 * (orchestrated by `loadLanguageBundle('en')` in `main.tsx`'s
 * bootstrap), then the service worker precaches the chunks.
 */
type LocaleModule = { default: Record<string, unknown> };
const enLoaders = import.meta.glob<LocaleModule>('../locales/en/*.json');

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
  'documents',
  'not-found',
  'backup-import',
  'backup-export',
  'reset',
  'document-import',
  'legal',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/** Languages i18next can render. */
export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;

/**
 * User-facing language-switcher gate. Flipped true in I18N-02-e
 * alongside the detector activation and `LanguageSection` component.
 * Retained as an exported constant so future tooling (e.g., feature
 * flag toggles) can still reference it.
 */
export const LANGUAGE_SWITCHER_ENABLED = true;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * i18next backend that resolves missing namespace bundles via the
 * lazy-loaded `enLoaders` glob. DE is preloaded into `init.resources`
 * below, so the backend is only consulted for EN (and any future
 * non-primary language).
 *
 * Inline rather than via `i18next-resources-to-backend` to avoid a
 * dependency for ~20 lines of glue.
 */
const lazyBackend: BackendModule = {
  type: 'backend',
  init: () => {},
  read: (language, namespace, callback) => {
    if (language !== 'en') {
      callback(null, {});
      return;
    }
    const path = `../locales/en/${namespace}.json`;
    const loader = enLoaders[path];
    if (!loader) {
      callback(null, {});
      return;
    }
    loader().then(
      (mod) => {
        callback(null, mod.default);
      },
      (err: unknown) => {
        callback(err instanceof Error ? err : new Error(String(err)), false);
      },
    );
  },
};

/**
 * Eagerly fetch every namespace for `language` and add it to i18n's
 * resource store. Call from `main.tsx` before mounting React when the
 * detected language is non-primary (i.e. not DE), so the first render
 * paints translated strings instead of raw keys.
 */
export async function loadLanguageBundle(language: SupportedLanguage): Promise<void> {
  if (language === 'de') return; // DE is statically preloaded
  await i18n.loadNamespaces([...NAMESPACES]);
  await i18n.loadLanguages([language]);
}

/**
 * Synchronous i18next initialization.
 *
 * DE resources are statically imported (eager) so the German first-paint
 * cost is unchanged. EN resources are wired through the lazy backend
 * above; `partialBundledLanguages: true` tells i18next to consult the
 * backend only for namespaces missing from the preloaded resource map.
 *
 * Initial language comes from `detectInitialLanguage()`:
 *   1. localStorage `phylax-language` (user preference)
 *   2. `navigator.languages[0]` or `navigator.language` prefix
 *   3. `'en'` fallback
 *
 * `fallbackLng: false` by design. Missing keys surface as raw keys
 * instead of cross-language fallback. All populated namespaces have
 * full DE+EN parity after I18N-02-d.
 */
void i18n
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
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
        documents: documentsDE,
        'not-found': notFoundDE,
        'backup-import': backupImportDE,
        'backup-export': backupExportDE,
        reset: resetDE,
        'document-import': documentImportDE,
        legal: legalDE,
      },
    },
    partialBundledLanguages: true,
    lng: detectInitialLanguage(),
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    fallbackLng: false,
    defaultNS: 'common',
    ns: NAMESPACES as unknown as string[],
    interpolation: {
      // React already escapes by default; let it do that job.
      escapeValue: false,
    },
    react: {
      // Synchronous DE resources; EN is awaited in main.tsx bootstrap
      // before mount, so Suspense is still not needed.
      useSuspense: false,
    },
  });

export default i18n;
