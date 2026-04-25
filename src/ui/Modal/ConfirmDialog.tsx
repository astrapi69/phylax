import { useId, useRef, type ReactNode } from 'react';
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { ModalBody } from './ModalBody';
import { ModalFooter } from './ModalFooter';

export type ConfirmDialogVariant = 'default' | 'destructive';

export interface ConfirmDialogProps {
  open: boolean;
  /** Closes without confirming. Called on cancel button, Escape, optional backdrop. */
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /**
   * Visual + a11y variant.
   * - `default`: blue confirm button, role="dialog".
   * - `destructive`: red confirm button, role="alertdialog" (immediate
   *   screen-reader announcement; for irreversible flows). Cancel
   *   focused on mount per Phylax convention.
   */
  variant?: ConfirmDialogVariant;
  /**
   * Disable the confirm button (e.g., for type-challenge gating like
   * `ResetDialog`'s "type RESET to enable").
   */
  confirmDisabled?: boolean;
  /**
   * While true, the irreversible action is in flight. Suppresses
   * Escape + backdrop close to prevent interrupting the operation
   * mid-execution. Confirm and cancel buttons are disabled and the
   * confirm label switches to `busyLabel` if provided.
   */
  busy?: boolean;
  /** Label shown on the confirm button while `busy` is true. */
  busyLabel?: string;
  /** data-testid on the underlying Modal. */
  testId?: string;
  /** Optional data-testid on the cancel button. */
  cancelTestId?: string;
  /** Optional data-testid on the confirm button. */
  confirmTestId?: string;
  /** Optional extra content rendered above the footer (e.g., type-challenge input). */
  extraBody?: ReactNode;
}

/**
 * Convenience wrapper around `<Modal>` for the ubiquitous title +
 * body + cancel/confirm pattern.
 *
 * Defaults follow Phylax convention (5 of 8 existing dialogs default
 * to cancel-focus, regardless of variant): cancel button is focused
 * on mount. Callers needing confirm-default focus override via the
 * underlying `<Modal initialFocusRef>` (use `<Modal>` directly).
 *
 * `variant="destructive"` automatically sets `role="alertdialog"` on
 * the underlying Modal so screen readers announce content immediately.
 * Visual treatment: red confirm button.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = 'default',
  confirmDisabled = false,
  busy = false,
  busyLabel,
  testId,
  cancelTestId,
  confirmTestId,
  extraBody,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isDestructive = variant === 'destructive';
  const confirmClass = isDestructive
    ? 'rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
    : 'rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600';

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      role={isDestructive ? 'alertdialog' : 'dialog'}
      closeOnEscape={!busy}
      closeOnBackdropClick={false}
      initialFocusRef={cancelRef}
      size="md"
      testId={testId}
    >
      <ModalHeader titleId={titleId}>{title}</ModalHeader>
      <ModalBody>
        <div className="text-sm text-gray-800 dark:text-gray-200">{body}</div>
        {extraBody ? <div className="mt-3">{extraBody}</div> : null}
      </ModalBody>
      <ModalFooter>
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          data-testid={cancelTestId}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled || busy}
          data-testid={confirmTestId}
          className={confirmClass}
        >
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
