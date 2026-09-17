import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Legal notice (Impressum) per Section 5 DDG / Section 18(2) MStV.
 *
 * Standalone full-screen route reachable without unlocking the vault
 * (no AppShell, no ProtectedRoute), so a first-time visitor or a
 * locked user can read it. Content and structure mirror the
 * Bibliogon Impressum (sibling project, same operator), adapted for
 * Befaro's health-data context.
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

        <section aria-labelledby="impressum-responsible-heading" className="space-y-1">
          <h2
            id="impressum-responsible-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('responsible.heading')}
          </h2>
          <p className="text-sm text-gray-800 dark:text-gray-200" data-testid="impressum-address">
            {t('responsible.name')}
            <br />
            {t('responsible.address-line1')}
            <br />
            {t('responsible.address-line2')}
            <br />
            {t('responsible.address-line3')}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {t('responsible.email-label')}:{' '}
            <a
              href={`mailto:${t('responsible.email-value')}`}
              className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {t('responsible.email-value')}
            </a>
          </p>
        </section>

        <section aria-labelledby="impressum-mstv-heading" className="space-y-1">
          <h2
            id="impressum-mstv-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('mstv.heading')}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('mstv.body')}</p>
        </section>

        <TextSection id="offer" t={t} />
        <TextSection id="liability-content" t={t} />
        <TextSection id="liability-links" t={t} />
        <TextSection id="copyright" t={t} />
        <TextSection id="dispute-resolution" t={t} />

        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('stand')}{' '}
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

type SectionId =
  | 'offer'
  | 'liability-content'
  | 'liability-links'
  | 'copyright'
  | 'dispute-resolution';

function TextSection({ id, t }: { id: SectionId; t: (key: string) => string }) {
  const titleId = `impressum-${id}-heading`;
  return (
    <section aria-labelledby={titleId} className="space-y-1">
      <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {t(`${id}.heading`)}
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">{t(`${id}.body`)}</p>
    </section>
  );
}
