import { useAIConfig } from '../../ai-config';
import type { ParseResult } from '../parser/types';
import type { ChatError } from '../../ai-chat/api/types';
import { CleanupButton } from './CleanupButton';
import { totalEntityCount } from './parseFailureDetection';

export type CleanupSubState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'impossible' }
  | { kind: 'parse-failed-after-cleanup'; rawCleaned: string }
  | { kind: 'error'; error: ChatError };

interface ImportCleanupScreenProps {
  parseResult: ParseResult;
  cleanup: CleanupSubState;
  onRequestCleanup: () => void;
  onProceedWithPartial: () => void;
  onRestart: () => void;
  onNavigateSettings: () => void;
}

const CHAT_ERROR_MESSAGE: Record<ChatError['kind'], string> = {
  auth: 'API-Schluessel ungueltig. Bitte pruefen unter Einstellungen.',
  'rate-limit': 'Zu viele Anfragen. Bitte warte einen Moment und versuche erneut.',
  server: 'Der KI-Dienst ist voruebergehend nicht erreichbar.',
  network: 'Keine Internetverbindung.',
  unknown: 'Fehler beim KI-Dienst.',
};

function chatErrorMessage(error: ChatError): string {
  if (error.kind === 'unknown') {
    return `${CHAT_ERROR_MESSAGE.unknown} (${error.message})`;
  }
  return CHAT_ERROR_MESSAGE[error.kind];
}

/**
 * Failure screen rendered when the parser could not make enough sense
 * of the user's paste to proceed. Offers an AI-assisted cleanup path
 * when the AI assistant is configured, a settings link otherwise, and
 * (for soft failures) a "proceed with partial result" escape hatch.
 */
export function ImportCleanupScreen({
  parseResult,
  cleanup,
  onRequestCleanup,
  onProceedWithPartial,
  onRestart,
  onNavigateSettings,
}: ImportCleanupScreenProps) {
  const { state: aiConfig } = useAIConfig();
  const aiConfigured = aiConfig.status === 'configured';
  const total = totalEntityCount(parseResult);
  const isEmpty = total === 0 && parseResult.profile === null;

  const summary = isEmpty
    ? 'Es konnten keine Inhalte extrahiert werden.'
    : `Nur wenige Eintraege erkannt (${total} insgesamt). Moeglicherweise ist das Format fuer unseren Parser ungewoehnlich.`;

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-red-700 dark:text-red-300">
        <span aria-hidden>!</span> Parser-Ergebnis
      </h1>
      <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {summary}
      </p>

      {cleanup.kind === 'loading' && (
        <p
          role="status"
          aria-live="polite"
          data-testid="cleanup-loading"
          className="mb-4 text-sm text-gray-700 dark:text-gray-300"
        >
          KI bereinigt Markdown...
        </p>
      )}

      {cleanup.kind === 'impossible' && (
        <p
          role="alert"
          data-testid="cleanup-impossible"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          Die KI konnte keine verwertbare Struktur aus deiner Eingabe herauslesen. Bitte pruefe den
          Inhalt manuell.
        </p>
      )}

      {cleanup.kind === 'error' && (
        <p
          role="alert"
          data-testid="cleanup-error"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {chatErrorMessage(cleanup.error)}
        </p>
      )}

      {cleanup.kind === 'parse-failed-after-cleanup' && (
        <div
          data-testid="cleanup-parse-failed"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="mb-2">
            Auch die bereinigte Ausgabe konnte nicht geparst werden. Hier die Roh-Ausgabe der KI zur
            manuellen Pruefung:
          </p>
          <pre
            data-testid="cleanup-raw-output"
            className="max-h-64 overflow-auto rounded bg-white p-2 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200"
          >
            {cleanup.rawCleaned}
          </pre>
        </div>
      )}

      {!aiConfigured && cleanup.kind === 'idle' && (
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          Konfiguriere den KI-Assistenten in den Einstellungen, um automatische Bereinigung zu
          nutzen.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Neu versuchen
        </button>

        {aiConfigured && (
          <CleanupButton
            onRequestCleanup={onRequestCleanup}
            disabled={cleanup.kind === 'loading'}
          />
        )}

        {!aiConfigured && (
          <button
            type="button"
            onClick={onNavigateSettings}
            data-testid="cleanup-settings-link"
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Zu den Einstellungen
          </button>
        )}

        {!isEmpty && (
          <button
            type="button"
            onClick={onProceedWithPartial}
            data-testid="cleanup-proceed-partial"
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Mit Teilergebnis fortfahren
          </button>
        )}
      </div>
    </div>
  );
}
