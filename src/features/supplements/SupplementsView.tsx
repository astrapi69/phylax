import { useDeferredValue, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUrlSearchParam } from '../../lib';
import { EmptyStatePanel, ListSkeleton, SearchInput } from '../../ui';
import { useSearch } from '../search-trigger';
import { SupplementCategoryGroup } from './SupplementCategoryGroup';
import { useSupplements } from './useSupplements';
import { useSupplementForm } from './useSupplementForm';
import { SupplementForm } from './SupplementForm';
import { SupplementDeleteDialog } from './SupplementDeleteDialog';
import { AddSupplementButton } from './AddSupplementButton';
import { filterSupplements, type LabeledSupplementGroup } from './filterSupplements';

/**
 * Supplements page at /supplements. Groups by category (daily,
 * regular, on-demand, paused), active categories first.
 *
 * O-14 adds manual create/edit/delete via the O-20 modal primitive.
 *
 * P-22c adds in-memory search via `?q=`. Magnifier trigger lives in
 * the global Header (P-22 architecture pivot); when SearchContext
 * reports `isOpen`, this view renders an inline SearchInput in a
 * sticky bar. No date dimension here, so no Stage 2 / calendar
 * toggle. Group-keep semantic mirrors Observations theme groups: a
 * category stays visible when EITHER its translated label matches
 * OR any of its supplements matches; in either case ALL supplements
 * in the group render so the user sees the category in context.
 */
export function SupplementsView() {
  const { t } = useTranslation('supplements');
  const { state, refetch } = useSupplements();
  const form = useSupplementForm({ onCommitted: refetch });

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const setQuery = useUrlSearchParam('q', query, setSearchParams);

  const { isOpen: searchOpen, close: closeSearch } = useSearch();
  const onEscapeWhenEmpty = () => closeSearch();
  const clearAllAndCollapse = () => {
    setQuery('');
    closeSearch();
  };

  const labeledGroups = useMemo<LabeledSupplementGroup[]>(() => {
    if (state.kind !== 'loaded') return [];
    return state.groups.map((g) => ({
      category: g.category,
      label: t(`category.${g.category}`),
      supplements: g.supplements,
    }));
  }, [state, t]);

  const filterResult = useMemo(
    () => filterSupplements(labeledGroups, { query: deferredQuery }),
    [labeledGroups, deferredQuery],
  );

  const isFiltering = deferredQuery.trim() !== '';

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
        <>
          {(searchOpen || isFiltering) && (
            <div className="sticky top-14 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-950">
              <div className="flex flex-wrap items-center gap-3">
                {isFiltering && (
                  <p
                    role="status"
                    aria-live="polite"
                    data-testid="supplements-match-count"
                    className="text-xs text-gray-600 dark:text-gray-400"
                  >
                    {filterResult.matchCount === 0
                      ? t('search.no-matches-counter')
                      : t('search.match-count', {
                          count: filterResult.matchCount,
                          total: filterResult.totalCount,
                        })}
                  </p>
                )}
              </div>
              {searchOpen && (
                <div className="flex flex-wrap items-center gap-3">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder={t('search.placeholder')}
                    ariaLabel={t('search.aria-label')}
                    clearLabel={t('search.clear')}
                    onEscapeWhenEmpty={onEscapeWhenEmpty}
                    onClear={clearAllAndCollapse}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {isFiltering && filterResult.groups.length === 0 ? (
            <NoMatchesState query={deferredQuery} />
          ) : (
            <div className="space-y-8">
              {filterResult.groups.map((group) => (
                <SupplementCategoryGroup
                  key={group.category}
                  category={group.category}
                  label={group.label}
                  supplements={group.supplements}
                  form={form}
                  highlightQuery={deferredQuery}
                />
              ))}
            </div>
          )}
        </>
      )}

      <SupplementForm form={form} />
      <SupplementDeleteDialog form={form} />
    </article>
  );
}

function NoMatchesState({ query }: { query: string }) {
  const { t } = useTranslation('supplements');
  return (
    <div
      role="status"
      data-testid="supplements-no-matches"
      className="rounded-sm border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
    >
      {t('search.no-matches', { query: query.trim() })}
    </div>
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
