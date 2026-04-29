import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  isDateRangeActive,
  parseDateRange,
  useUrlSearchParam,
  type DateRange,
} from '../../lib';
import { DateRangeFilter, EmptyStatePanel, ListSkeleton, SearchInput } from '../../ui';
import { useSearch } from '../search-trigger';
import { LabReportCard } from './LabReportCard';
import { useLabValues } from './useLabValues';
import { useLabReportForm } from './useLabReportForm';
import { useLabValueForm } from './useLabValueForm';
import { LabReportForm } from './LabReportForm';
import { LabReportDeleteDialog } from './LabReportDeleteDialog';
import { LabValueForm } from './LabValueForm';
import { LabValueDeleteDialog } from './LabValueDeleteDialog';
import { AddLabReportButton } from './AddLabReportButton';
import { filterLabReports } from './filterLabReports';

/**
 * Read-only lab values page at /lab-values. Shows lab reports
 * newest-first, each with its values table grouped by category.
 *
 * O-12a adds manual create/edit/delete of lab reports via the O-20
 * modal primitive. Empty reports (no values yet) render header-only,
 * surfacing the report shell users build incrementally.
 *
 * O-18 introduced the date-range filter via URL params `?from=YYYY-MM-DD`
 * and `?to=YYYY-MM-DD`. P-22b adds the search half via `?q=` and
 * folds both filter dimensions into the same two-stage progressive-
 * disclosure sticky-bar pattern shipped for ObservationsView in
 * P-22a (commit 2540119 + magnifier-right-align follow-up 3d4ce9f):
 *
 *   Stage 0: only the magnifier toggle is visible. If a filter is
 *            active (URL-driven or preserved across collapses), a
 *            small dot on the magnifier signals "filter set, UI
 *            hidden".
 *   Stage 1: search input + calendar toggle visible alongside the
 *            magnifier. Date inputs hidden.
 *   Stage 2: search input + date inputs both visible.
 *
 * Q10 row-keep semantic: when a search query matches a report
 * (header field OR any child value OR per-category assessment),
 * the entire report renders with all its values intact for
 * clinical context. Highlighting (handled per-cell + per-Markdown-
 * field by LabReportCard) shows only the actual matches.
 */
export function LabValuesView() {
  const { t } = useTranslation('lab-values');
  const { state, refetch } = useLabValues();
  const form = useLabReportForm({ onCommitted: refetch });
  const valueForm = useLabValueForm({ onCommitted: refetch });

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const setQuery = useUrlSearchParam('q', query, setSearchParams);

  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';

  // P-22 architecture pivot (matches ObservationsView refactor): the
  // magnifier trigger lives in the global Header via SearchContext.
  // `searchOpen` flows down; `dateOpen` stays local because the
  // calendar Stage 1 -> 2 toggle is view-specific.
  const { isOpen: searchOpen, close: closeSearch } = useSearch();
  const initialDateOpenRef = useRef<boolean>(fromParam !== '' || toParam !== '');
  const [dateOpen, setDateOpen] = useState<boolean>(initialDateOpenRef.current);
  const onCalendarClick = () => setDateOpen(true);
  const onEscapeWhenEmpty = () => closeSearch();
  const clearAllAndCollapse = () => {
    setQuery('');
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('q');
        params.delete('from');
        params.delete('to');
        return params;
      },
      { replace: true },
    );
    setDateOpen(false);
    closeSearch();
  };

  const dateRange: DateRange = useMemo(() => parseDateRange(searchParams), [searchParams]);
  const setDateParam = (key: 'from' | 'to', value: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === '') params.delete(key);
        else params.set(key, value);
        return params;
      },
      { replace: true },
    );
  };

  const filterResult = useMemo(() => {
    if (state.kind !== 'loaded') return null;
    return filterLabReports(state.reports, { query: deferredQuery, dateRange });
  }, [state, deferredQuery, dateRange]);

  const isFiltering = deferredQuery.trim() !== '' || isDateRangeActive(dateRange);

  if (state.kind === 'loading') {
    return <ListSkeleton variant="card" count={3} ariaLabel={t('loading.aria-label')} />;
  }

  if (state.kind === 'error') {
    if (state.error.kind === 'generic') {
      console.error('[LabValuesView]', state.error.detail);
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

  const reports = filterResult.reports;

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
        <AddLabReportButton form={form} />
      </header>

      {state.reports.length === 0 ? (
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
                    data-testid="lab-values-match-count"
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
                  {dateOpen && (
                    <DateRangeFilter
                      from={fromParam}
                      to={toParam}
                      onFromChange={(v) => setDateParam('from', v)}
                      onToChange={(v) => setDateParam('to', v)}
                      fromLabel={t('date-range.from')}
                      toLabel={t('date-range.to')}
                      groupAriaLabel={t('date-range.aria-label')}
                    />
                  )}
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
                  <CalendarToggle
                    dateOpen={dateOpen}
                    onClick={onCalendarClick}
                    openLabel={t('search.dates-open')}
                    alreadyOpenLabel={t('search.dates-shown')}
                  />
                </div>
              )}
            </div>
          )}

          {isFiltering && reports.length === 0 ? (
            <NoMatchesState query={deferredQuery} />
          ) : (
            <div className="space-y-6">
              {reports.map(({ report, valuesByCategory }) => (
                <LabReportCard
                  key={report.id}
                  report={report}
                  valuesByCategory={valuesByCategory}
                  form={form}
                  valueForm={valueForm}
                  highlightQuery={deferredQuery}
                />
              ))}
            </div>
          )}
        </>
      )}

      <LabReportForm form={form} />
      <LabReportDeleteDialog form={form} />
      <LabValueForm form={valueForm} />
      <LabValueDeleteDialog form={valueForm} />
    </article>
  );
}

function CalendarToggle({
  dateOpen,
  onClick,
  openLabel,
  alreadyOpenLabel,
}: {
  dateOpen: boolean;
  onClick: () => void;
  openLabel: string;
  alreadyOpenLabel: string;
}) {
  const label = dateOpen ? alreadyOpenLabel : openLabel;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={dateOpen}
      aria-pressed={dateOpen}
      title={label}
      disabled={dateOpen}
      data-testid="calendar-toggle"
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
    >
      <CalendarIcon />
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1z" />
    </svg>
  );
}

function NoMatchesState({ query }: { query: string }) {
  const { t } = useTranslation('lab-values');
  const trimmed = query.trim();
  return (
    <div
      role="status"
      data-testid="lab-values-no-matches"
      className="rounded-sm border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
    >
      {trimmed === '' ? t('date-range.no-matches') : t('search.no-matches', { query: trimmed })}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation('lab-values');
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
