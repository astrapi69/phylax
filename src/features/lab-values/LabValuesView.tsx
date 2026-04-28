import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  isDateRangeActive,
  isInDateRangeIso,
  parseDateRange,
  type DateRange,
} from '../../lib';
import { DateRangeFilter, EmptyStatePanel, ListSkeleton } from '../../ui';
import { LabReportCard } from './LabReportCard';
import { useLabValues } from './useLabValues';
import { useLabReportForm } from './useLabReportForm';
import { useLabValueForm } from './useLabValueForm';
import { LabReportForm } from './LabReportForm';
import { LabReportDeleteDialog } from './LabReportDeleteDialog';
import { LabValueForm } from './LabValueForm';
import { LabValueDeleteDialog } from './LabValueDeleteDialog';
import { AddLabReportButton } from './AddLabReportButton';

/**
 * Read-only lab values page at /lab-values. Shows lab reports
 * newest-first, each with its values table grouped by category.
 *
 * O-12a adds manual create/edit/delete of lab reports via the O-20
 * modal primitive. Empty reports (no values yet) render header-only,
 * surfacing the report shell users build incrementally.
 *
 * O-18 introduces the date-range filter. URL params `?from=YYYY-MM-DD`
 * and `?to=YYYY-MM-DD` (either or both, validated) narrow the report
 * list by `reportDate`. Filtering happens at view level on the
 * already-decrypted data, mirroring the O-17 pattern in
 * ObservationsView. The sticky bar matches P-19's pattern from
 * observations so the filter inputs stay reachable while scrolling
 * through long report lists.
 */
export function LabValuesView() {
  const { t } = useTranslation('lab-values');
  const { state, refetch } = useLabValues();
  const form = useLabReportForm({ onCommitted: refetch });
  const valueForm = useLabValueForm({ onCommitted: refetch });

  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';
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

  const isFiltering = isDateRangeActive(dateRange);
  const filteredReports = isFiltering
    ? state.reports.filter(({ report }) => isInDateRangeIso(report.reportDate, dateRange))
    : state.reports;

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
          <div className="sticky top-14 z-30 -mx-4 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-950">
            <DateRangeFilter
              from={fromParam}
              to={toParam}
              onFromChange={(v) => setDateParam('from', v)}
              onToChange={(v) => setDateParam('to', v)}
              fromLabel={t('date-range.from')}
              toLabel={t('date-range.to')}
              groupAriaLabel={t('date-range.aria-label')}
            />
          </div>
          {isFiltering && filteredReports.length === 0 ? (
            <NoMatchesState />
          ) : (
            <div className="space-y-6">
              {filteredReports.map(({ report, valuesByCategory }) => (
                <LabReportCard
                  key={report.id}
                  report={report}
                  valuesByCategory={valuesByCategory}
                  form={form}
                  valueForm={valueForm}
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

function NoMatchesState() {
  const { t } = useTranslation('lab-values');
  return (
    <div
      role="status"
      data-testid="lab-values-no-matches-in-range"
      className="rounded-sm border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
    >
      {t('date-range.no-matches')}
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
