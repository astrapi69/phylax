import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Document } from '../../domain';
import { DocumentRepository } from '../../db/repositories';

export interface DeleteDocumentButtonProps {
  document: Document;
}

type DeleteState = 'idle' | 'confirming' | 'deleting';

/**
 * Two-step destructive button: `[Delete document]` opens an inline
 * confirmation with [Cancel] [Confirm delete] buttons plus a warning
 * message that names the file and, if linked, the linked entity kind.
 *
 * Design decisions (D-08):
 * - Inline two-step instead of a modal — no modal system exists yet,
 *   and native `confirm()` is forbidden by coding-standards.md.
 * - Confirm button is visually destructive (red) and its focus-path
 *   default starts on Cancel, not Confirm, so a keyboard user
 *   entering confirm state via `Enter` on the primary button does
 *   NOT immediately activate the destructive action by pressing
 *   `Enter` again (a11y pattern for destructive flows).
 * - Escape while in confirm state returns to idle (standard cancel
 *   gesture). Escape handler is scoped to the component container,
 *   not a global `window` listener, so it cannot interfere with
 *   dialogs or inputs elsewhere.
 * - Touch target minimum 44px via `min-h-[44px]` on each button
 *   (WCAG 2.5.5 AAA baseline for destructive affordances).
 * - On unmount (navigation away), React resets local state
 *   automatically — a re-entered viewer starts in `idle`, never in
 *   a stale `confirming` state.
 *
 * `delete` on the repository already clears both metadata + blob
 * rows atomically and is idempotent on missing rows, so the orphan
 * case (metadata present, blob already absent) is handled silently.
 */
export function DeleteDocumentButton({ document }: DeleteDocumentButtonProps) {
  const { t } = useTranslation('documents');
  const navigate = useNavigate();
  const [state, setState] = useState<DeleteState>('idle');
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const linkedKind: 'observation' | 'lab-value' | null = document.linkedObservationId
    ? 'observation'
    : document.linkedLabValueId
      ? 'lab-value'
      : null;

  const openConfirm = useCallback(() => {
    setError(null);
    setState('confirming');
  }, []);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    setState('deleting');
    setError(null);
    try {
      const repo = new DocumentRepository();
      await repo.delete(document.id);
      navigate('/documents', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('confirming');
    }
  }, [document.id, navigate]);

  // Move focus to Cancel when entering confirm state so a keyboard
  // user whose Enter activated `[Delete document]` does not have the
  // Confirm button pre-focused. Re-triggers if the user re-enters
  // confirming from a failed-delete retry.
  useEffect(() => {
    if (state === 'confirming') {
      cancelButtonRef.current?.focus();
    }
  }, [state]);

  if (state === 'idle') {
    return (
      <section
        className="mt-2 flex justify-end"
        aria-label={t('viewer.delete.region-label')}
        data-testid="delete-region"
      >
        <button
          type="button"
          onClick={openConfirm}
          className="inline-flex min-h-[44px] items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-700 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-900/30"
          data-testid="delete-document-btn"
        >
          {t('viewer.delete.button')}
        </button>
      </section>
    );
  }

  // state === 'confirming' | 'deleting'
  const isDeleting = state === 'deleting';
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isDeleting) {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <section
      className="mt-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-700 dark:bg-red-950/30"
      aria-label={t('viewer.delete.region-label')}
      data-testid="delete-region"
      onKeyDown={onKeyDown}
    >
      <p className="text-red-900 dark:text-red-200" data-testid="delete-confirm-message">
        {t('viewer.delete.confirm', { filename: document.filename })}
      </p>
      {linkedKind && (
        <p className="mt-1 text-red-800 dark:text-red-300" data-testid="delete-linked-warning">
          {t('viewer.delete.linked-warning', { kind: t(`link.kind.${linkedKind}`) })}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-red-800 dark:text-red-300" data-testid="delete-error">
          {t('viewer.delete.error')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={cancel}
          disabled={isDeleting}
          className="inline-flex min-h-[44px] items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          data-testid="delete-cancel-btn"
        >
          {t('viewer.delete.cancel')}
        </button>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={isDeleting}
          className="inline-flex min-h-[44px] items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="delete-confirm-btn"
        >
          {isDeleting ? t('viewer.delete.deleting') : t('viewer.delete.confirm-button')}
        </button>
      </div>
    </section>
  );
}
