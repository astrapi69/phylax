import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

const GITHUB_PRIVACY_STATEMENT_URL =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';

interface ProviderLink {
  id: string;
  label: string;
  url: string;
}

/**
 * Real, official privacy-policy URLs for the AI providers Befaro
 * supports (`src/features/ai/providers.ts`). Anthropic's URL matches
 * the one already used and verified in `AIDisclaimer.tsx` /
 * `PrivacyInfoContent.tsx`, kept consistent rather than switching to
 * a different Anthropic URL. Local providers (LM Studio, Ollama,
 * custom) have no fixed operator, so no link applies.
 */
const PROVIDER_LINKS: readonly ProviderLink[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', url: 'https://privacy.claude.com/' },
  { id: 'openai', label: 'OpenAI (GPT)', url: 'https://openai.com/policies/privacy-policy' },
  { id: 'google', label: 'Google (Gemini)', url: 'https://policies.google.com/privacy' },
  { id: 'mistral', label: 'Mistral', url: 'https://mistral.ai/terms/#privacy-policy' },
] as const;

const SUMMARY_ORDER = ['no-server', 'no-tracking', 'hosting'] as const;

type SectionId =
  | 'hosting'
  | 'local-storage'
  | 'api-key'
  | 'update-check'
  | 'ai-chat'
  | 'file-import'
  | 'external-links'
  | 'no-tracking';

const SECTION_ORDER: readonly SectionId[] = [
  'hosting',
  'local-storage',
  'api-key',
  'update-check',
  'ai-chat',
  'file-import',
  'external-links',
  'no-tracking',
] as const;

/**
 * Full Datenschutzerklaerung (DSGVO Art. 13), distinct from the short
 * onboarding teaser at `/privacy`. Standalone full-screen route,
 * reachable without unlocking the vault (no AppShell, no
 * ProtectedRoute), so a first-time visitor can read it before ever
 * creating an account. Content and structure mirror the Bibliogon
 * privacy policy (sibling project, same operator), adapted for
 * Befaro's specifics: encrypted (not plaintext) local storage
 * including the AI API key, multi-provider AI chat, no URL-based
 * import.
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
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('stand')}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('intro')}</p>
        </header>

        <section aria-labelledby="datenschutz-controller-heading" className="space-y-1">
          <h2
            id="datenschutz-controller-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('controller.heading')}
          </h2>
          <p className="text-sm text-gray-800 dark:text-gray-200" data-testid="datenschutz-address">
            {t('controller.name')}
            <br />
            {t('controller.address-line1')}
            <br />
            {t('controller.address-line2')}
            <br />
            {t('controller.address-line3')}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {t('controller.email-label')}:{' '}
            <a
              href={`mailto:${t('controller.email-value')}`}
              className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {t('controller.email-value')}
            </a>
          </p>
        </section>

        <section aria-labelledby="datenschutz-summary-heading" className="space-y-2">
          <h2
            id="datenschutz-summary-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('summary.heading')}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            {SUMMARY_ORDER.map((key) => (
              <li key={key}>{t(`summary.list.${key}`)}</li>
            ))}
          </ul>
        </section>

        {SECTION_ORDER.map((key) => (
          <PolicySection key={key} id={key} t={t} />
        ))}

        <section aria-labelledby="datenschutz-rights-heading" className="space-y-1">
          <h2
            id="datenschutz-rights-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('section.rights.heading')}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('section.rights.intro')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t('section.rights.practical')}
          </p>
        </section>

        <TextSection id="contact" t={t} />
        <TextSection id="changes" t={t} />

        <p className="text-sm">
          <Link
            to="/impressum"
            className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            {t('see-also-impressum')}
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

function PolicySection({ id, t }: { id: SectionId; t: TFunction<'privacy-policy'> }) {
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
      {id === 'ai-chat' && (
        <div className="text-sm">
          <p className="text-gray-700 dark:text-gray-300">{t('section.ai-chat.providers-intro')}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {PROVIDER_LINKS.map((provider) => (
              <li key={provider.id}>
                <a
                  href={provider.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  {provider.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TextSection({ id, t }: { id: 'contact' | 'changes'; t: TFunction<'privacy-policy'> }) {
  const titleId = `datenschutz-${id}-heading`;
  return (
    <section aria-labelledby={titleId} className="space-y-1">
      <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {t(`${id}.heading`)}
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">{t(`${id}.body`)}</p>
    </section>
  );
}
