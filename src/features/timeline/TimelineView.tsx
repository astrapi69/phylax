import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyStatePanel, ListSkeleton } from '../../ui';
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
    return <ListSkeleton variant="row" count={6} ariaLabel={t('loading.aria-label')} />;
  }

  if (state.kind === 'error') {
    if (state.error.kind === 'generic') {
      console.error('[TimelineView]', state.error.detail);
    }
    const message =
      state.error.kind === 'no-profile' ? t('common:error.no-profile') : t('error.load-failed');
    return (
      <div
        role="alert"
        className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
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
    <EmptyStatePanel
      title={t('empty.title')}
      body={t('empty.body')}
      cta={
        <p>
          <Link
            to="/import"
            className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('empty.cta')}
          </Link>
          {t('empty.suffix')}
        </p>
      }
    />
  );
}
