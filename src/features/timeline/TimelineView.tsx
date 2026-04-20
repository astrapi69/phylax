import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TimelineEntryCard } from './TimelineEntryCard';
import { useTimeline } from './useTimeline';

/**
 * Read-only timeline page at /timeline. Entries are rendered newest
 * first (see useTimeline for the ordering rationale).
 */
export function TimelineView() {
  const { t } = useTranslation('timeline');
  const { state } = useTimeline();

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
        {t('loading')}
      </div>
    );
  }

  if (state.kind === 'error') {
    if (state.error.kind === 'generic') {
      console.error('[TimelineView]', state.error.detail);
    }
    const message =
      state.error.kind === 'no-profile' ? t('error.no-profile') : t('error.load-failed');
    return (
      <div
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      >
        {message}
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <header className="border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
      </header>

      {state.entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {state.entries.map((entry) => (
            <TimelineEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  const { t } = useTranslation('timeline');
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
      <p>{t('empty.body')}</p>
      <p className="mt-2">
        <Link
          to="/import"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t('empty.cta')}
        </Link>
        {t('empty.suffix')}
      </p>
    </div>
  );
}
