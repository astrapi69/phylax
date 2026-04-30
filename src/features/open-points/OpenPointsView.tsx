import { useDeferredValue, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { preferredScrollBehavior, useActiveMatch, useUrlSearchParam } from '../../lib';
import { EmptyStatePanel, ListSkeleton, MatchNavButton, SearchInput } from '../../ui';
import { useSearch } from '../search-trigger';
import { ContextGroup } from './ContextGroup';
import { useOpenPoints } from './useOpenPoints';
import { useOpenPointForm } from './useOpenPointForm';
import { OpenPointForm } from './OpenPointForm';
import { OpenPointDeleteDialog } from './OpenPointDeleteDialog';
import { AddOpenPointButton } from './AddOpenPointButton';
import { filterOpenPoints } from './filterOpenPoints';

/**
 * Open points checklist page at /open-points. Items grouped by
 * context, unresolved first then resolved.
 *
 * O-15: full add/toggle/delete + edit via the O-20 modal primitive.
 * Single `useOpenPointForm` hook drives modal create/edit/delete
 * plus the no-modal `toggle()` fast-path for resolved-flag flips.
 *
 * P-22d adds in-memory search via `?q=`. Magnifier trigger lives in
 * the global Header (P-22 architecture pivot); when SearchContext
 * reports `isOpen`, this view renders an inline SearchInput in a
 * sticky bar. No date dimension here, so no Stage 2 / calendar
 * toggle. Group-keep semantic mirrors Observations theme groups +
 * Supplements category groups: a context group stays visible when
 * EITHER its label matches OR any of its items matches; in either
 * case ALL items in the group render so the user sees the group in
 * context.
 */
export function OpenPointsView() {
  const { t } = useTranslation('open-points');
  const { state, refetch } = useOpenPoints();
  const form = useOpenPointForm({ onCommitted: refetch });

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

  const filterResult = useMemo(() => {
    if (state.kind !== 'loaded') return null;
    return filterOpenPoints(state.groups, { query: deferredQuery });
  }, [state, deferredQuery]);

  const isFiltering = deferredQuery.trim() !== '';

  // P-22b/c/d-polish: row-level match navigation. `matchCount` is the
  // number of retained context groups (group-keep semantic); each
  // rendered ContextGroup carries `data-match-row` (1-based).
  const totalMatches = filterResult?.matchCount ?? 0;
  const { activeIndex, scrollSignal, next, prev } = useActiveMatch(deferredQuery, totalMatches);

  useEffect(() => {
    if (scrollSignal === 0) return;
    if (activeIndex === 0) return;
    const target = document.querySelector(`[data-match-row="${activeIndex}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' });
    }
  }, [scrollSignal, activeIndex]);

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

  if (!filterResult) return null;

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
        <>
          {(searchOpen || isFiltering) && (
            <div className="sticky top-14 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-950">
              <div className="flex flex-wrap items-center gap-3">
                {isFiltering && (
                  <p
                    role="status"
                    aria-live="polite"
                    data-testid="open-points-match-count"
                    className="text-xs text-gray-600 dark:text-gray-400"
                  >
                    {filterResult.matchCount === 0
                      ? t('search.no-matches-counter')
                      : totalMatches >= 2
                        ? t('search.match-count-active', {
                            current: activeIndex,
                            total: totalMatches,
                          })
                        : t('search.match-count', {
                            count: filterResult.matchCount,
                            total: filterResult.totalCount,
                          })}
                  </p>
                )}
                {isFiltering && totalMatches >= 2 && (
                  <>
                    <MatchNavButton
                      direction="up"
                      onClick={prev}
                      ariaLabel={t('search.prev-match')}
                      testId="open-points-search-prev"
                    />
                    <MatchNavButton
                      direction="down"
                      onClick={next}
                      ariaLabel={t('search.next-match')}
                      testId="open-points-search-next"
                    />
                  </>
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
                    onEnter={next}
                    onShiftEnter={prev}
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
              {filterResult.groups.map((group, index) => (
                <div
                  key={group.context}
                  data-match-row={isFiltering ? index + 1 : undefined}
                  className="scroll-mt-24"
                >
                  <ContextGroup
                    context={group.context}
                    items={group.items}
                    form={form}
                    highlightQuery={deferredQuery}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <OpenPointForm form={form} />
      <OpenPointDeleteDialog form={form} />
    </article>
  );
}

function NoMatchesState({ query }: { query: string }) {
  const { t } = useTranslation('open-points');
  return (
    <div
      role="status"
      data-testid="open-points-no-matches"
      className="rounded-sm border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
    >
      {t('search.no-matches', { query: query.trim() })}
    </div>
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
