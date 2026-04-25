import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Document } from '../../domain';
import { ConfirmDialog } from '../../ui';
import {
  countDerivedEntities,
  deleteWithProvenance,
} from '../document-import/deleteWithProvenance';

export interface DeleteDocumentButtonProps {
  document: Document;
}

type DeleteState = 'idle' | 'confirming' | 'deleting';

/**
 * Two-step destructive button: trigger button opens a destructive
 * `<ConfirmDialog>` (O-20 modal primitive) with the cascade-warning
 * copy and a destructive Confirm action.
 *
 * O-20 migration: previously inline two-step (no focus trap, no
 * backdrop, scoped Escape via onKeyDown). Now uses the shared
 * `<ConfirmDialog variant="destructive">` so focus is trapped, the
 * backdrop dims, and Escape is suppressed while the delete is in
 * flight (matches D-08 + IMP-05 destructive-flow patterns).
 *
 * D-08 design decisions preserved:
 * - Destructive Confirm (red), Cancel focused on mount.
 * - Escape cancels in `confirming`, suppressed in `deleting` (busy).
 * - Repository's two-row atomic delete is idempotent on missing rows.
 * - Cascade through `deleteWithProvenance` clears `sourceDocumentId`
 *   on derived entities before deleting the document (IMP-05).
 */
export function DeleteDocumentButton({ document }: DeleteDocumentButtonProps) {
  const { t } = useTranslation('documents');
  const navigate = useNavigate();
  const [state, setState] = useState<DeleteState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [derivedCount, setDerivedCount] = useState<number>(0);

  const linkedKind: 'observation' | 'lab-value' | null = document.linkedObservationId
    ? 'observation'
    : document.linkedLabValueId
      ? 'lab-value'
      : null;

  const openConfirm = useCallback(async () => {
    setError(null);
    setState('confirming');
    // Surface derived-entity count for the cascade warning (IMP-05).
    // Best-effort: failure to count does not block the delete path.
    try {
      const counts = await countDerivedEntities(document.id);
      setDerivedCount(counts.total);
    } catch {
      setDerivedCount(0);
    }
  }, [document.id]);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    setState('deleting');
    setError(null);
    try {
      const result = await deleteWithProvenance(document.id);
      if (result.kind === 'cleanup-failed') {
        setError(t('viewer.delete.derived-cleanup-failed'));
        setState('confirming');
        return;
      }
      navigate('/documents', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('confirming');
    }
  }, [document.id, navigate, t]);

  const isOpen = state !== 'idle';
  const isDeleting = state === 'deleting';

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
      <ConfirmDialog
        open={isOpen}
        onClose={cancel}
        title={t('viewer.delete.button')}
        body={
          <>
            <p data-testid="delete-confirm-message">
              {t('viewer.delete.confirm', { filename: document.filename })}
            </p>
            {linkedKind && (
              <p
                className="mt-1 text-red-800 dark:text-red-300"
                data-testid="delete-linked-warning"
              >
                {t('viewer.delete.linked-warning', { kind: t(`link.kind.${linkedKind}`) })}
              </p>
            )}
            {derivedCount > 0 && (
              <p
                className="mt-1 text-red-800 dark:text-red-300"
                data-testid="delete-derived-warning"
              >
                {t('viewer.delete.derived-entries-warning', { count: derivedCount })}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-2 text-red-800 dark:text-red-300"
                data-testid="delete-error"
              >
                {t('viewer.delete.error')}
              </p>
            )}
          </>
        }
        confirmLabel={t('viewer.delete.confirm-button')}
        cancelLabel={t('viewer.delete.cancel')}
        onConfirm={confirmDelete}
        variant="destructive"
        busy={isDeleting}
        busyLabel={t('viewer.delete.deleting')}
        testId="delete-confirm-dialog"
        cancelTestId="delete-cancel-btn"
        confirmTestId="delete-confirm-btn"
      />
    </section>
  );
}
