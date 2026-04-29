import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Settings section that links to the in-app legal pages.
 *
 * Two anchors:
 *   - `/privacy` — the existing first-run PrivacyView (ONB-01b).
 *     Reachable from `/welcome` on first run; this section gives
 *     post-onboarding users a way back to the same content.
 *   - `/license` — the new MIT license verbatim render (P-12).
 *
 * Anchors are real `<Link>` elements so keyboard activation,
 * right-click "open in new tab", and browser preloading all behave
 * normally; matches the pattern set by ImportProfileLinkButton.
 */
export function LegalSection() {
  const { t } = useTranslation('legal');
  return (
    <section aria-labelledby="legal-section-heading" className="space-y-3">
      <h2
        id="legal-section-heading"
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('section.heading')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('section.description')}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/privacy"
          data-testid="legal-link-privacy"
          className="flex min-h-[44px] items-center rounded-sm border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('section.privacy-link')}
        </Link>
        <Link
          to="/license"
          data-testid="legal-link-license"
          className="flex min-h-[44px] items-center rounded-sm border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('section.license-link')}
        </Link>
      </div>
    </section>
  );
}
