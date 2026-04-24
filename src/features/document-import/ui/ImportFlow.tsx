import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useImportSession } from '../useImportSession';
import type { UseImportSessionOptions } from '../useImportSession';
import type { CommitResult, DraftSelection } from '../commit';
import { totalCommitted } from '../commit';
import type { AiCallError } from '../aiCallError';
import { isRetryableAiCallError } from '../aiCallError';
import { ConsentDialog } from './ConsentDialog';
import { ClassificationConfirm } from './ClassificationConfirm';
import { ReviewPanel } from './ReviewPanel';

export interface ImportFlowProps {
  /** Source file picked outside the modal (the trigger button passes it in). */
  initialFile: File;
  /** Called whenever the modal needs to close (cancel, success, decline). */
  onClose: (result?: CommitResult) => void;
  /** Test seam — overrides for the underlying pipeline functions. */
  pipelineOverrides?: UseImportSessionOptions['pipeline'];
}

/**
 * Modal orchestrator for an IMP-04 import session.
 *
 * On mount, kicks off `pickFile(initialFile)`. Renders the appropriate
 * sub-view per `state.kind`. The hook owns the in-memory file
 * reference so we can drop it on close.
 *
 * Focus management mirrors the CommitPreviewModal precedent:
 * `role="dialog"` + `aria-modal="true"`, focus-trapped to the dialog,
 * Escape cancels.
 */
export function ImportFlow({ initialFile, onClose, pipelineOverrides }: ImportFlowProps) {
  const { t } = useTranslation('document-import');
  const session = useImportSession({ pipeline: pipelineOverrides });
  const dialogRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void session.pickFile(initialFile);
  }, [initialFile, session]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      session.cancel();
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, session]);

  const cancelAndClose = () => {
    session.cancel();
    onClose();
  };

  const commitCount = useMemo(() => {
    if (session.state.kind !== 'reviewing') return 0;
    return (
      session.state.selection.observations.length +
      session.state.selection.labValues.length +
      session.state.selection.supplements.length +
      session.state.selection.openPoints.length
    );
  }, [session.state]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-flow-title"
      data-testid="import-flow"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:shadow-black/60"
      >
        <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 id="import-flow-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t('import.flow.title')}
          </h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {t('import.flow.memory-hint')}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4" data-testid="import-flow-body">
          <FlowBody
            state={session.state}
            t={t}
            commitCount={commitCount}
            onConfirmClassification={() => {
              void session.confirmClassification();
            }}
            onRejectClassification={session.rejectClassification}
            onSelectionChange={(s: DraftSelection) => session.setSelection(s)}
            onEditObservation={session.editObservation}
            onEditLabValue={session.editLabValue}
            onEditSupplement={session.editSupplement}
            onEditOpenPoint={session.editOpenPoint}
          />
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          {session.state.kind === 'reviewing' ? (
            <>
              <button
                type="button"
                onClick={cancelAndClose}
                className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('import.flow.cancel')}
              </button>
              <button
                type="button"
                disabled={commitCount === 0}
                onClick={() => {
                  void session.commit({ sourceFileName: initialFile.name });
                }}
                aria-disabled={commitCount === 0}
                className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/60 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                {commitCount === 0
                  ? t('import.review.commit-button-empty')
                  : t('import.review.commit-button', { count: commitCount })}
              </button>
            </>
          ) : session.state.kind === 'error' ? (
            <ErrorFooter
              t={t}
              error={session.state.error}
              onRetry={() => {
                void session.retry();
              }}
              onClose={cancelAndClose}
            />
          ) : session.state.kind === 'done' ? (
            <DoneFooter
              t={t}
              result={session.state.result}
              onClose={() =>
                onClose(session.state.kind === 'done' ? session.state.result : undefined)
              }
            />
          ) : (
            <button
              type="button"
              onClick={cancelAndClose}
              className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('import.flow.cancel')}
            </button>
          )}
        </footer>
      </div>

      {session.state.kind === 'consent-prompt' ? (
        <ConsentDialog
          reason={session.state.reason}
          onGrant={(remember) => {
            void session.grantConsent(remember);
          }}
          onDecline={() => {
            session.declineConsent();
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}

interface FlowBodyProps {
  state: ReturnType<typeof useImportSession>['state'];
  t: TFunction<'document-import'>;
  commitCount: number;
  onConfirmClassification: () => void;
  onRejectClassification: () => void;
  onSelectionChange: (next: DraftSelection) => void;
  onEditObservation: ReturnType<typeof useImportSession>['editObservation'];
  onEditLabValue: ReturnType<typeof useImportSession>['editLabValue'];
  onEditSupplement: ReturnType<typeof useImportSession>['editSupplement'];
  onEditOpenPoint: ReturnType<typeof useImportSession>['editOpenPoint'];
}

function FlowBody({
  state,
  t,
  commitCount,
  onConfirmClassification,
  onRejectClassification,
  onSelectionChange,
  onEditObservation,
  onEditLabValue,
  onEditSupplement,
  onEditOpenPoint,
}: FlowBodyProps) {
  void commitCount;
  switch (state.kind) {
    case 'idle':
    case 'preparing':
      return <Status text={t('import.flow.preparing')} testId="status-preparing" />;
    case 'classifying':
      return <Status text={t('import.flow.classifying')} testId="status-classifying" />;
    case 'extracting':
      return <Status text={t('import.flow.extracting')} testId="status-extracting" />;
    case 'committing':
      return <Status text={t('import.flow.committing')} testId="status-committing" />;
    case 'consent-prompt':
      // The ConsentDialog renders separately as an overlay.
      return <Status text={t('import.flow.preparing')} testId="status-consent-pending" />;
    case 'classification-confirm':
      return (
        <ClassificationConfirm
          classification={state.classification}
          onConfirm={onConfirmClassification}
          onReject={onRejectClassification}
        />
      );
    case 'reviewing':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('import.review.intro')}</p>
          <ReviewPanel
            drafts={state.drafts}
            selection={state.selection}
            onSelectionChange={onSelectionChange}
            onEditObservation={onEditObservation}
            onEditLabValue={onEditLabValue}
            onEditSupplement={onEditSupplement}
            onEditOpenPoint={onEditOpenPoint}
          />
        </div>
      );
    case 'done':
      return <DoneSummary t={t} result={state.result} />;
    case 'error':
      return <ErrorBody t={t} error={state.error} />;
  }
}

function Status({ text, testId }: { text: string; testId: string }) {
  return (
    <p data-testid={testId} role="status" className="text-sm text-gray-700 dark:text-gray-300">
      {text}
    </p>
  );
}

function ErrorBody({
  t,
  error,
}: {
  t: TFunction<'document-import'>;
  error: { kind: 'prepare' | 'commit'; message: string } | { kind: 'ai'; ai: AiCallError };
}) {
  let message: string;
  if (error.kind === 'ai') {
    message = t(`ai.error.${error.ai.kind}`);
  } else if (error.kind === 'prepare') {
    message = t('import.flow.prepare-error', { detail: error.message });
  } else {
    message = t('import.flow.commit-error', { detail: error.message });
  }
  return (
    <p
      data-testid="import-flow-error"
      role="alert"
      className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
    >
      {message}
    </p>
  );
}

function ErrorFooter({
  t,
  error,
  onRetry,
  onClose,
}: {
  t: TFunction<'document-import'>;
  error: { kind: 'prepare' | 'commit'; message: string } | { kind: 'ai'; ai: AiCallError };
  onRetry: () => void;
  onClose: () => void;
}) {
  const canRetry =
    (error.kind === 'ai' && isRetryableAiCallError(error.ai)) || error.kind === 'prepare';
  return (
    <>
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          {t('import.flow.retry')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {t('import.flow.close')}
      </button>
    </>
  );
}

function DoneSummary({ t, result }: { t: TFunction<'document-import'>; result: CommitResult }) {
  if (result.abortError === 'no-profile') {
    return (
      <p
        data-testid="import-flow-done-no-profile"
        role="alert"
        className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      >
        {t('import.flow.no-profile')}
      </p>
    );
  }
  const succeeded = totalCommitted(result);
  const failed =
    result.observations.failed +
    result.labValues.failed +
    result.supplements.failed +
    result.openPoints.failed;
  return (
    <div data-testid="import-flow-done" className="flex flex-col gap-2 text-sm">
      <p className="font-semibold text-green-700 dark:text-green-400">{t('import.done.title')}</p>
      <p>{t('import.done.summary', { succeeded })}</p>
      {result.labReportId ? <p>{t('import.done.lab-report')}</p> : null}
      {failed > 0 ? (
        <p className="text-amber-700 dark:text-amber-300">
          {t('import.done.partial-failures', { failed })}
        </p>
      ) : null}
    </div>
  );
}

function DoneFooter({
  t,
  result,
  onClose,
}: {
  t: TFunction<'document-import'>;
  result: CommitResult;
  onClose: () => void;
}) {
  void result;
  return (
    <button
      type="button"
      onClick={onClose}
      className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
    >
      {t('import.flow.close')}
    </button>
  );
}
