import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { WarningCallout } from '../../ui';

const GITHUB_PRIVACY_STATEMENT_URL =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';

type SectionKey = 'hosting' | 'local-storage' | 'encryption' | 'ai-chat' | 'no-tracking';

const SECTION_ORDER: readonly SectionKey[] = [
  'hosting',
  'local-storage',
  'encryption',
  'ai-chat',
  'no-tracking',
] as const;

const RIGHTS_ORDER = ['access', 'deletion', 'objection'] as const;

/**
 * Full Datenschutzerklaerung (DSGVO Art. 13), distinct from the short
 * onboarding teaser at `/privacy`. Standalone full-screen route,
 * reachable without unlocking the vault (no AppShell, no
 * ProtectedRoute), so a first-time visitor can read it before ever
 * creating an account. Technical content is sourced from PRIVACY.md;
 * the controller fields are placeholders until the maintainer fills
 * them in and a lawyer has reviewed the text (draft notice makes that
 * state visible rather than silently shipping unreviewed legal text).
 */
export function DatenschutzView() {
  const { t } = useTranslation('privacy-policy');
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

        <section aria-labelledby="datenschutz-controller-heading" className="space-y-2">
          <h2
            id="datenschutz-controller-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('controller.heading')}
          </h2>
          <dl className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
            <div>
              <dt className="inline font-medium">{t('controller.name-label')}: </dt>
              <dd className="inline">{t('controller.name-value')}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t('controller.address-label')}: </dt>
              <dd className="inline">{t('controller.address-value')}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t('controller.email-label')}: </dt>
              <dd className="inline">{t('controller.email-value')}</dd>
            </div>
          </dl>
        </section>

        {SECTION_ORDER.map((key) => (
          <PolicySection key={key} id={key} t={t} />
        ))}

        <section aria-labelledby="datenschutz-rights-heading" className="space-y-2">
          <h2
            id="datenschutz-rights-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('section.rights.heading')}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('section.rights.intro')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            {RIGHTS_ORDER.map((key) => (
              <li key={key}>{t(`section.rights.list.${key}`)}</li>
            ))}
          </ul>
        </section>

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

function PolicySection({
  id,
  t,
}: {
  id: SectionKey;
  t: TFunction<'privacy-policy'>;
}): ReactElement {
  const titleId = `datenschutz-${id}-heading`;
  return (
    <section aria-labelledby={titleId} className="space-y-2">
      <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {t(`section.${id}.heading`)}
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">{t(`section.${id}.body`)}</p>
      {id === 'hosting' && (
        <p className="text-sm">
          <a
            href={GITHUB_PRIVACY_STATEMENT_URL}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            {t('section.hosting.link-label')}
          </a>
        </p>
      )}
    </section>
  );
}
