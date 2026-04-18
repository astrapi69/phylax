import { useTranslation } from 'react-i18next';

/**
 * Three-section privacy summary rendered inside the PrivacyInfoPopover and
 * potentially in other disclosure surfaces. Pure presentational: no props,
 * no state, no dependencies on chat or settings context.
 *
 * Source of truth for retention claim:
 * https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
 * (verified 2026-04-18)
 */
export function PrivacyInfoContent() {
  const { t } = useTranslation('ai-config');

  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <section>
        <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('privacy-info.phylax-section.heading')}
        </h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('privacy-info.phylax-section.bullet-1')}</li>
          <li>{t('privacy-info.phylax-section.bullet-2')}</li>
          <li>{t('privacy-info.phylax-section.bullet-3')}</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('privacy-info.anthropic-section.heading')}
        </h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('privacy-info.anthropic-section.bullet-1')}</li>
          <li>{t('privacy-info.anthropic-section.bullet-2')}</li>
          <li>{t('privacy-info.anthropic-section.bullet-3')}</li>
        </ul>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {t('privacy-info.anthropic-section.details-prefix')}
          <a
            href="https://privacy.claude.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('privacy-info.anthropic-section.link-label')}
          </a>
        </p>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('privacy-info.user-control-section.heading')}
        </h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('privacy-info.user-control-section.bullet-1')}</li>
          <li>{t('privacy-info.user-control-section.bullet-2')}</li>
          <li>{t('privacy-info.user-control-section.bullet-3')}</li>
          <li>{t('privacy-info.user-control-section.bullet-4')}</li>
          <li>{t('privacy-info.user-control-section.bullet-5')}</li>
          <li>{t('privacy-info.user-control-section.bullet-6')}</li>
        </ul>
      </section>
    </div>
  );
}
