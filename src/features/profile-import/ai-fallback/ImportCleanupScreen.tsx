import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

function chatErrorMessage(t: TFunction<'import'>, error: ChatError): string {
  if (error.kind === 'unknown') {
    return t('cleanup.chat-error.unknown-with-detail', { detail: error.message });
  }
  return t(`cleanup.chat-error.${error.kind}`);
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
  const { t } = useTranslation('import');
  const { state: aiConfig } = useAIConfig();
  const aiConfigured = aiConfig.status === 'configured';
  const total = totalEntityCount(parseResult);
  const isEmpty = total === 0 && parseResult.profile === null;

  const summary = isEmpty ? t('cleanup.summary.empty') : t('cleanup.summary.partial', { total });

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-red-700 dark:text-red-300">
        <span aria-hidden>!</span> {t('cleanup.heading')}
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
          {t('cleanup.loading')}
        </p>
      )}

      {cleanup.kind === 'impossible' && (
        <p
          role="alert"
          data-testid="cleanup-impossible"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {t('cleanup.impossible')}
        </p>
      )}

      {cleanup.kind === 'error' && (
        <p
          role="alert"
          data-testid="cleanup-error"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {chatErrorMessage(t, cleanup.error)}
        </p>
      )}

      {cleanup.kind === 'parse-failed-after-cleanup' && (
        <div
          data-testid="cleanup-parse-failed"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="mb-2">{t('cleanup.parse-failed-after')}</p>
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
          {t('cleanup.not-configured')}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('cleanup.action.restart')}
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
            {t('cleanup.action.go-to-settings')}
          </button>
        )}

        {!isEmpty && (
          <button
            type="button"
            onClick={onProceedWithPartial}
            data-testid="cleanup-proceed-partial"
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('cleanup.action.proceed-partial')}
          </button>
        )}
      </div>
    </div>
  );
}
