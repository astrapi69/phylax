import { Link } from 'react-router-dom';
import { ThemeGroup } from './ThemeGroup';
import { useObservations } from './useObservations';

/**
 * Read-only observations page at /observations. Groups by theme,
 * sorts groups alphabetically (German locale), and renders each
 * observation as a collapsible card.
 */
export function ObservationsView() {
  const { state } = useObservations();

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
        Beobachtungen werden geladen...
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Beobachtungen</h1>
      </header>

      {state.groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {state.groups.map((group) => (
            <ThemeGroup key={group.theme} theme={group.theme} observations={group.observations} />
          ))}
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
      <p>Noch keine Beobachtungen erfasst.</p>
      <p className="mt-2">
        <Link
          to="/import"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Importiere ein Profil
        </Link>
        , um Beobachtungen zu erfassen.
      </p>
    </div>
  );
}
