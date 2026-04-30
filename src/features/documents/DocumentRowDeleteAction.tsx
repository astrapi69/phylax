import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Document } from '../../domain';
import { ConfirmDialog } from '../../ui';
import {
  countDerivedEntities,
  deleteWithProvenance,
} from '../document-import/deleteWithProvenance';

export interface DocumentRowDeleteActionProps {
  document: Document;
  /**
   * Called after a successful delete. Caller is responsible for any
   * follow-up (refetching the list, removing the row, etc.). The
   * action component does NOT navigate.
   */
  onDeleted: () => void;
}

type DeleteState = 'idle' | 'confirming' | 'deleting';

/**
 * Inline list-row delete affordance for the documents list (P-16).
 *
 * Parallel to `DeleteDocumentButton` (used by DocumentViewer at
 * `/documents/:id`); this variant lives inside a `<DocumentListItem>`
 * row and reuses the destructive `<ConfirmDialog>` (O-20 primitive)
 * with the same cascade-warning copy. On success the caller's
 * `onDeleted` callback fires; the component does not navigate, so
 * the user stays on the list and the row vanishes on next refetch.
 *
 * A11y: the trigger is an icon-only `<button>` (44 x 44 hit target)
 * with an aria-label that names the filename so screen-reader users
 * can disambiguate the destructive action across rows.
 *
 * Layout: this component is a sibling of the row's `<Link>`, never
 * a child of it (avoids the nested-interactive WCAG violation that
 * surfaced during O-10 production E2E).
 */
export function DocumentRowDeleteAction({ document, onDeleted }: DocumentRowDeleteActionProps) {
  const { t } = useTranslation('documents');
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
      onDeleted();
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('confirming');
    }
  }, [document.id, onDeleted, t]);

  const isOpen = state !== 'idle';
  const isDeleting = state === 'deleting';

  return (
    <>
      <button
        type="button"
        onClick={() => void openConfirm()}
        aria-label={t('list.row-delete.aria-label', { filename: document.filename })}
        data-testid={`document-row-delete-${document.id}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-300 dark:hover:bg-red-900/30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
      <ConfirmDialog
        open={isOpen}
        onClose={cancel}
        title={t('viewer.delete.button')}
        body={
          <>
            <p data-testid={`document-row-delete-message-${document.id}`}>
              {t('viewer.delete.confirm', { filename: document.filename })}
            </p>
            {linkedKind && (
              <p
                className="mt-1 text-red-800 dark:text-red-300"
                data-testid={`document-row-delete-linked-${document.id}`}
              >
                {t('viewer.delete.linked-warning', { kind: t(`link.kind.${linkedKind}`) })}
              </p>
            )}
            {derivedCount > 0 && (
              <p
                className="mt-1 text-red-800 dark:text-red-300"
                data-testid={`document-row-delete-derived-${document.id}`}
              >
                {t('viewer.delete.derived-entries-warning', { count: derivedCount })}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-2 text-red-800 dark:text-red-300"
                data-testid={`document-row-delete-error-${document.id}`}
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
        testId={`document-row-delete-dialog-${document.id}`}
      />
    </>
  );
}
