import { useEffect, useRef } from 'react';
import type { EntityCounts } from '../import';

interface ConfirmDialogProps {
  existingCounts: EntityCounts;
  targetProfileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive-action modal shown when the import target already holds
 * data. Escape cancels. Click outside does NOT cancel, since an
 * accidental dismiss could lose the user's place in the flow. Focus
 * lands on the cancel button by default (safer default for destructive
 * dialogs).
 */
export function ConfirmDialog({
  existingCounts,
  targetProfileName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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

  const lines: string[] = [];
  if (existingCounts.observations > 0) lines.push(`${existingCounts.observations} Beobachtungen`);
  if (existingCounts.labReports > 0)
    lines.push(`${existingCounts.labReports} Laborbefunde (${existingCounts.labValues} Werte)`);
  if (existingCounts.supplements > 0) lines.push(`${existingCounts.supplements} Supplemente`);
  if (existingCounts.openPoints > 0) lines.push(`${existingCounts.openPoints} offene Punkte`);
  if (existingCounts.timelineEntries > 0)
    lines.push(`${existingCounts.timelineEntries} Verlaufsnotizen`);
  if (existingCounts.profileVersions > 0)
    lines.push(`${existingCounts.profileVersions} Profilversionen`);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-replace-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900 dark:shadow-black/60"
        role="document"
      >
        <h2
          id="confirm-replace-title"
          className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          <span aria-hidden>⚠</span> Bestehende Daten ersetzen?
        </h2>
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
          "{targetProfileName}" enthält bereits:
        </p>
        <ul className="mb-4 space-y-1 text-sm text-gray-800 dark:text-gray-200">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mb-6 text-sm text-red-700 dark:text-red-300">
          Diese Daten werden beim Import unwiderruflich gelöscht und durch die neuen ersetzt.
        </p>
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
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Ja, ersetzen
          </button>
        </div>
      </div>
    </div>
  );
}
