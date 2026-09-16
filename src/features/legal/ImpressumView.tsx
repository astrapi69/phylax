import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WarningCallout } from '../../ui';

/**
 * Legal notice (Impressum) per Section 5 DDG / Section 18(2) MStV.
 *
 * Standalone full-screen route reachable without unlocking the vault
 * (no AppShell, no ProtectedRoute), so a first-time visitor or a
 * locked user can read it. The responsible-party fields are
 * placeholders until the maintainer fills them in; the draft notice
 * makes that state visible in the UI rather than silently shipping
 * incorrect legal information.
 */
export function ImpressumView() {
  const { t } = useTranslation('impressum');
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
      <article className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mb-2 text-2xl font-bold text-gray-900 focus:outline-hidden dark:text-gray-100"
          >
            {t('heading')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('intro')}</p>
        </header>

        <WarningCallout severity="warning">{t('draft-notice')}</WarningCallout>

        <section aria-labelledby="impressum-responsible-heading" className="space-y-2">
          <h2
            id="impressum-responsible-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('responsible.heading')}
          </h2>
          <dl className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
            <div>
              <dt className="inline font-medium">{t('responsible.name-label')}: </dt>
              <dd className="inline">{t('responsible.name-value')}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t('responsible.address-label')}: </dt>
              <dd className="inline">{t('responsible.address-value')}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t('responsible.email-label')}: </dt>
              <dd className="inline">{t('responsible.email-value')}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t('responsible.vat-id-label')}: </dt>
              <dd className="inline">{t('responsible.vat-id-value')}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="impressum-disclaimer-heading" className="space-y-2">
          <h2
            id="impressum-disclaimer-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('disclaimer.heading')}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('disclaimer.content-body')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('disclaimer.links-body')}</p>
        </section>

        <p className="text-sm">
          <Link
            to="/datenschutz"
            className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            {t('see-also-privacy-policy')}
          </Link>
        </p>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          {t('back')}
        </button>
      </article>
    </main>
  );
}
