import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';
import { useReturnFocus } from './useReturnFocus';
import { useBodyScrollLock } from './useBodyScrollLock';

export type ModalRole = 'dialog' | 'alertdialog';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  /** Visibility. When false, primitive renders nothing (no portal mount). */
  open: boolean;
  /** Called on Escape (when allowed) or backdrop click (when allowed). */
  onClose: () => void;
  /**
   * `aria-labelledby` target id. The caller's title element MUST set
   * `id={titleId}` so screen readers can announce the dialog by name.
   * Pass an explicit id (use `useId()` at the call site) so re-mounts
   * and StrictMode double-invocations don't drift.
   */
  titleId: string;
  /** Optional `aria-describedby` target id. */
  descriptionId?: string;
  /**
   * `role` attribute. Default `dialog`. Use `alertdialog` for
   * destructive irreversible flows where the screen reader should
   * announce content immediately rather than wait for focus. The
   * primitive does NOT auto-pick - caller decides per-use.
   */
  role?: ModalRole;
  /**
   * Default `false` (Phylax convention: mid-flow dialogs avoid
   * accidental dismissal). Pass `true` for opt-in dismissable modals
   * where backdrop click safely closes.
   */
  closeOnBackdropClick?: boolean;
  /**
   * Default `true`. Set false during in-flight irreversible operations
   * to prevent Escape from interrupting (e.g., a destructive action
   * mid-execution).
   */
  closeOnEscape?: boolean;
  /**
   * Element to receive focus on mount. When omitted, focus lands on
   * the first focusable element inside the dialog (HTML5 native
   * dialog semantics). Convenience wrappers like `ConfirmDialog` use
   * this prop to override per project convention.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Tailwind size variant. Default `md`. */
  size?: ModalSize;
  /**
   * z-index for the modal layer. Default `50`. Convention: nested
   * modals add +10 per level. Caller supplies the value; primitive
   * does NOT auto-stack. If automatic stacking ever needs to exist,
   * add it then with concrete consumers.
   */
  zIndex?: number;
  /**
   * Portal target. Default `document.body`. Test harnesses or embedded
   * contexts can override.
   */
  portalTarget?: HTMLElement;
  /** data-testid on the dialog element for component tests. */
  testId?: string;
  children: ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

/**
 * Headless modal primitive. Owns focus trap, focus restore on close,
 * body scroll lock, portal mounting, Escape handling, backdrop click
 * handling, and aria invariants. Visual content is the caller's
 * responsibility (compose with `ModalHeader` / `ModalBody` /
 * `ModalFooter` for the standard layout).
 *
 * Defaults follow Phylax convention rather than generic modal-library
 * conventions: backdrop-click does NOT close (mid-flow data-loss
 * avoidance), focus lands on first-focusable not last action button
 * (HTML5 native dialog semantics).
 *
 * Renders nothing when `open` is false - no hidden DOM, no portal
 * mount, no scroll lock. Toggling `open` mounts/unmounts the entire
 * subtree; transient state inside the modal does not persist across
 * close/reopen cycles by design.
 */
export function Modal({
  open,
  onClose,
  titleId,
  descriptionId,
  role = 'dialog',
  closeOnBackdropClick = false,
  closeOnEscape = true,
  initialFocusRef,
  size = 'md',
  zIndex = 50,
  portalTarget,
  testId,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, open);
  useReturnFocus(open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    const firstFocusable = dialog.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [open, initialFocusRef]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;
  const target = portalTarget ?? document.body;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex }}
      onClick={(e) => {
        if (!closeOnBackdropClick) return;
        // Only close when the backdrop itself was clicked, not bubbled
        // events from inner elements.
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid={testId ? `${testId}-backdrop` : undefined}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid={testId}
        className={`flex max-h-[90vh] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:shadow-black/60`}
      >
        {children}
      </div>
    </div>,
    target,
  );
}

/** Stable id generator for modal `titleId` callers that want one. */
export function useModalTitleId(): string {
  return useId();
}
