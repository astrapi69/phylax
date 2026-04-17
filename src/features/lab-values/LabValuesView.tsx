import { Link } from 'react-router-dom';
import { LabReportCard } from './LabReportCard';
import { useLabValues } from './useLabValues';

/**
 * Read-only lab values page at /lab-values. Shows lab reports
 * newest-first, each with its values table grouped by category.
 */
export function LabValuesView() {
  const { state } = useLabValues();

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
        Laborwerte werden geladen...
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      >
        {state.message}
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <header className="border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Laborwerte</h1>
      </header>

      {state.reports.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {state.reports.map(({ report, valuesByCategory }) => (
            <LabReportCard key={report.id} report={report} valuesByCategory={valuesByCategory} />
          ))}
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
      <p>Noch keine Laborwerte erfasst.</p>
      <p className="mt-2">
        <Link
          to="/import"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Importiere ein Profil mit Blutwerten
        </Link>
        , um sie hier zu sehen.
      </p>
    </div>
  );
}
