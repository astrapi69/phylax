import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LICENSE_TEXT } from './licenseText';

/**
 * Static license-text view at /license.
 *
 * Renders the verbatim repo-root LICENSE file inside the app shell so
 * users can read the terms offline without leaving Phylax. P-12 second
 * half: privacy was already at /privacy via ONB-01b; this completes
 * the in-app legal surface.
 *
 * `<pre>` preserves line breaks + the legalese line-folding without
 * relying on Markdown rendering (introducing react-markdown for one
 * static file would be needless coupling). `whitespace-pre-wrap`
 * keeps long paragraphs flowing on narrow viewports.
 *
 * P-07-a: `tabindex="0"` makes the `<pre>` a keyboard focus stop so
 * users who navigate by Tab + arrow keys (no scroll wheel, screen-
 * magnification users) can scroll through the license without a
 * pointer device. role="region" + aria-label name the focus stop
 * for assistive tech.
 */
export function LicenseView() {
  const { t } = useTranslation('legal');
  return (
    <article className="space-y-4">
      <header className="border-b border-gray-200 pb-3 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('license.heading')}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('license.intro')}
        </p>
      </header>
      <pre
        data-testid="license-text"
        tabIndex={0}
        role="region"
        aria-label={t('license.heading')}
        className="overflow-x-auto rounded-sm border border-gray-200 bg-gray-50 p-4 text-sm whitespace-pre-wrap text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {LICENSE_TEXT}
      </pre>
      <p className="text-sm">
        <Link
          to="/settings"
          className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          {t('license.back-to-settings')}
        </Link>
      </p>
    </article>
  );
}
