import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyStatePanel, ListSkeleton } from '../../ui';
import { SupplementCategoryGroup } from './SupplementCategoryGroup';
import { useSupplements } from './useSupplements';
import { useSupplementForm } from './useSupplementForm';
import { SupplementForm } from './SupplementForm';
import { SupplementDeleteDialog } from './SupplementDeleteDialog';
import { AddSupplementButton } from './AddSupplementButton';

/**
 * Supplements page at /supplements. Groups by category (daily,
 * regular, on-demand, paused), active categories first.
 *
 * O-14 adds manual create/edit/delete via the O-20 modal primitive.
 * Single `useSupplementForm` hook drives all three modes; per-card
 * actions on each `SupplementCard` open the form bound to that
 * supplement.
 */
export function SupplementsView() {
  const { t } = useTranslation('supplements');
  const { state, refetch } = useSupplements();
  const form = useSupplementForm({ onCommitted: refetch });

  if (state.kind === 'loading') {
    return <ListSkeleton variant="row" count={6} ariaLabel={t('loading.aria-label')} />;
  }

  if (state.kind === 'error') {
    if (state.error.kind === 'generic') {
      console.error('[SupplementsView]', state.error.detail);
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
        <AddSupplementButton form={form} />
      </header>

      {state.groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {state.groups.map((group) => (
            <SupplementCategoryGroup
              key={group.category}
              category={group.category}
              label={t(`category.${group.category}`)}
              supplements={group.supplements}
              form={form}
            />
          ))}
        </div>
      )}

      <SupplementForm form={form} />
      <SupplementDeleteDialog form={form} />
    </article>
  );
}

function EmptyState() {
  const { t } = useTranslation('supplements');
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
