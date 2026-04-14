import type { ImportResult } from '../import';

interface ResultScreenProps {
  outcome:
    | { kind: 'success'; importResult: ImportResult; targetProfileName: string }
    | { kind: 'failure'; message: string };
  onNavigateHome: () => void;
  onRestart: () => void;
}

export function ResultScreen({ outcome, onNavigateHome, onRestart }: ResultScreenProps) {
  if (outcome.kind === 'success') {
    const { created } = outcome.importResult;
    return (
      <div>
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-green-700">
          <span aria-hidden>✓</span> Import erfolgreich
        </h1>
        <p className="mb-4 text-sm text-gray-700">In "{outcome.targetProfileName}" importiert:</p>
        <ul className="mb-6 space-y-1 text-sm text-gray-800">
          <li>{created.observations} Beobachtungen</li>
          <li>
            {created.labReports} Laborbefund{created.labReports === 1 ? '' : 'e'} (
            {created.labValues} Werte)
          </li>
          <li>{created.supplements} Supplemente</li>
          <li>{created.openPoints} offene Punkte</li>
          <li>{created.timelineEntries} Verlaufsnotizen</li>
          <li>{created.profileVersions} Profilversionen</li>
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Zur Übersicht
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Weiteren Import
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-red-700">
        <span aria-hidden>✗</span> Import fehlgeschlagen
      </h1>
      <p className="mb-2 text-sm font-medium text-gray-900">Fehler:</p>
      <p
        className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        role="alert"
      >
        {outcome.message}
      </p>
      <p className="mb-6 text-sm text-gray-700">Deine Daten wurden nicht geändert.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Erneut versuchen
        </button>
        <button
          type="button"
          onClick={onNavigateHome}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
