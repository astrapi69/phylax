import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type SectionKey = 'does' | 'does-not' | 'means';

const SECTION_ORDER: readonly SectionKey[] = ['does', 'does-not', 'means'] as const;

/**
 * First-run privacy disclosure. Three informational paragraphs set
 * expectations: what Phylax does, what it does not, and what that means
 * for the user. The real data-loss acknowledgment happens on SetupView.
 */
export function PrivacyView() {
  const { t } = useTranslation('onboarding');
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
      <div className="w-full max-w-xl">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mb-8 text-center text-3xl font-bold text-gray-900 focus:outline-none dark:text-gray-100"
        >
          {t('privacy.headline')}
        </h1>

        <div className="space-y-6">
          {SECTION_ORDER.map((key) => (
            <section key={key} aria-labelledby={`privacy-${key}-title`}>
              <h2
                id={`privacy-${key}-title`}
                className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100"
              >
                {t(`privacy.section.${key}.title`)}
              </h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t(`privacy.section.${key}.body`)}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-col-reverse items-center gap-3 md:flex-row md:justify-between">
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            className="rounded border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('privacy.cta.back')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/setup')}
            className="w-full rounded bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 md:w-auto"
          >
            {t('privacy.cta.primary')}
          </button>
        </div>
      </div>
    </main>
  );
}
