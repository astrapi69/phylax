import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyStatePanel, ListSkeleton } from '../../ui';
import { ContextGroup } from './ContextGroup';
import { useOpenPoints } from './useOpenPoints';
import { useOpenPointForm } from './useOpenPointForm';
import { OpenPointForm } from './OpenPointForm';
import { OpenPointDeleteDialog } from './OpenPointDeleteDialog';
import { AddOpenPointButton } from './AddOpenPointButton';

/**
 * Open points checklist page at /open-points. Items grouped by
 * context, unresolved first then resolved.
 *
 * O-15: full add/toggle/delete + edit via the O-20 modal primitive.
 * Single `useOpenPointForm` hook drives modal create/edit/delete
 * plus the no-modal `toggle()` fast-path for resolved-flag flips.
 */
export function OpenPointsView() {
  const { t } = useTranslation('open-points');
  const { state, refetch } = useOpenPoints();
  const form = useOpenPointForm({ onCommitted: refetch });

  if (state.kind === 'loading') {
    return <ListSkeleton variant="card" count={4} ariaLabel={t('loading.aria-label')} />;
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
        className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      >
        {message}
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('common:entity.open-points')}
        </h1>
        <AddOpenPointButton form={form} />
      </header>

      {form.toggleError && (
        <p
          role="alert"
          className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          data-testid="open-points-toggle-error"
        >
          {t('toggle.error', { detail: form.toggleError })}
        </p>
      )}

      {state.groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {state.groups.map((group) => (
            <ContextGroup
              key={group.context}
              context={group.context}
              items={group.items}
              form={form}
            />
          ))}
        </div>
      )}

      <OpenPointForm form={form} />
      <OpenPointDeleteDialog form={form} />
    </article>
  );
}

function EmptyState() {
  const { t } = useTranslation('open-points');
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
