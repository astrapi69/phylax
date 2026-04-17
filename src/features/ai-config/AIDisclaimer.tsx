import { useEffect, useRef } from 'react';

interface AIDisclaimerProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal shown on first AI activation. Spells out the three non-negotiable
 * facts: no medical advice, data leaves the device, user controls access.
 * Confirmation is required before any API key is persisted.
 *
 * Focus lands on the cancel button by default (safer for a consent flow).
 * Escape cancels. Tab is trapped inside the dialog.
 */
export function AIDisclaimer({ onConfirm, onCancel }: AIDisclaimerProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-disclaimer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900 dark:shadow-black/60"
        role="document"
      >
        <h2
          id="ai-disclaimer-title"
          className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          KI-Assistent aktivieren
        </h2>
        <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Wichtige Hinweise:
        </p>
        <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Keine medizinische Beratung:
            </span>{' '}
            Der KI-Assistent strukturiert deine Eingaben, stellt aber keine Diagnosen und gibt keine
            medizinischen Empfehlungen.
          </li>
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Daten verlassen dein Geraet:
            </span>{' '}
            Wenn du den KI-Assistenten nutzt, werden deine Eingaben an den gewaehlten KI-Anbieter
            (Anthropic) gesendet. Phylax speichert keine Chat-Verlaeufe.
          </li>
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Du kontrollierst den Zugang:
            </span>{' '}
            Dein API-Schluessel wird verschluesselt auf deinem Geraet gespeichert. Du kannst die
            KI-Funktion jederzeit deaktivieren und den Schluessel loeschen.
          </li>
        </ol>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Verstanden, KI aktivieren
          </button>
        </div>
      </div>
    </div>
  );
}
