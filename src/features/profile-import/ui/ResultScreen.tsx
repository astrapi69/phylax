import { useTranslation } from 'react-i18next';
import type { ImportResult } from '../import';

interface ResultScreenProps {
  outcome:
    | { kind: 'success'; importResult: ImportResult; targetProfileName: string }
    | { kind: 'failure'; detail: string };
  onNavigateHome: () => void;
  onRestart: () => void;
}

export function ResultScreen({ outcome, onNavigateHome, onRestart }: ResultScreenProps) {
  const { t } = useTranslation('import');
  if (outcome.kind === 'success') {
    const { created } = outcome.importResult;
    return (
      <div>
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-green-700 dark:text-green-400">
          <span aria-hidden>✓</span> {t('result.success.heading')}
        </h1>
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          {t('result.success.body', { name: outcome.targetProfileName })}
        </p>
        <ul className="mb-6 space-y-1 text-sm text-gray-800 dark:text-gray-200">
          <li>{t('common:counts.observations', { count: created.observations })}</li>
          <li>
            {t('counts.lab-report-with-values', {
              count: created.labReports,
              values: created.labValues,
            })}
          </li>
          <li>{t('common:counts.supplements', { count: created.supplements })}</li>
          <li>{t('counts.open-points', { count: created.openPoints })}</li>
          <li>{t('counts.timeline-entries', { count: created.timelineEntries })}</li>
          <li>{t('counts.profile-versions', { count: created.profileVersions })}</li>
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t('result.success.home')}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('result.success.restart')}
          </button>
        </div>
      </div>
    );
  }

  console.error('[ResultScreen]', outcome.detail);
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-red-700 dark:text-red-300">
        <span aria-hidden>✗</span> {t('result.failure.heading')}
      </h1>
      <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        {t('result.failure.label-error')}
      </p>
      <p
        className="mb-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        role="alert"
      >
        {t('result.failure.body')}
      </p>
      <p className="mb-6 text-sm text-gray-700 dark:text-gray-300">
        {t('result.failure.unchanged')}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {t('result.failure.retry')}
        </button>
        <button
          type="button"
          onClick={onNavigateHome}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t('common:action.cancel')}
        </button>
      </div>
    </div>
  );
}
