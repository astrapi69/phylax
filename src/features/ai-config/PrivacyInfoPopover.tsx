import { useEffect, useRef } from 'react';
import { PrivacyInfoContent } from './PrivacyInfoContent';

interface PrivacyInfoPopoverProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal dialog that renders PrivacyInfoContent. Controlled: the consumer
 * owns the trigger button and the open state so the same popover can be
 * invoked from the chat header icon, the settings link, or anywhere else.
 *
 * Closes on Escape, backdrop click, and the explicit Schliessen button.
 * Focus lands on the close button on open; Tab is trapped inside. This
 * mirrors the AIDisclaimer pattern so keyboard users encounter consistent
 * behavior across the app's dialogs.
 */
export function PrivacyInfoPopover({ open, onClose }: PrivacyInfoPopoverProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-info-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="document"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:shadow-black/60"
      >
        <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="privacy-info-title"
            className="text-lg font-bold text-gray-900 dark:text-gray-100"
          >
            Datenschutz beim KI-Chat
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <PrivacyInfoContent />
        </div>

        <footer className="flex justify-end border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Schliessen
          </button>
        </footer>
      </div>
    </div>
  );
}
