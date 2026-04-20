import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ContextGroup } from './ContextGroup';
import { useOpenPoints } from './useOpenPoints';

/**
 * Read-only open points checklist page at /open-points. Items are
 * grouped by context and sorted with unresolved first. Checkboxes
 * are display-only; editing belongs to a future E-series task.
 */
export function OpenPointsView() {
  const { t } = useTranslation('open-points');
  const { state } = useOpenPoints();

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
        {t('loading')}
      </div>
    );
  }

  if (state.kind === 'error') {
    if (state.error.kind === 'generic') {
      console.error('[OpenPointsView]', state.error.detail);
    }
    const message =
      state.error.kind === 'no-profile' ? t('common:error.no-profile') : t('error.load-failed');
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('common:entity.open-points')}
        </h1>
      </header>

      {state.groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {state.groups.map((group) => (
            <ContextGroup key={group.context} context={group.context} items={group.items} />
          ))}
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  const { t } = useTranslation('open-points');
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
