import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EntityCounts, PerTypeReplace } from '../import';

interface ConfirmDialogProps {
  existingCounts: EntityCounts;
  targetProfileName: string;
  onConfirm: (selection: PerTypeReplace) => void;
  onCancel: () => void;
}

function initialSelection(counts: EntityCounts): Required<PerTypeReplace> {
  // Default: every type that has existing data is checked. The user's
  // gesture to land on this dialog is "import into a non-empty target",
  // so the legacy "replace everything" intent is preserved by default.
  // Per-type opt-out lets them keep specific sections.
  return {
    observations: counts.observations > 0,
    labData: counts.labReports > 0 || counts.labValues > 0,
    supplements: counts.supplements > 0,
    openPoints: counts.openPoints > 0,
    timelineEntries: counts.timelineEntries > 0,
    profileVersions: counts.profileVersions > 0,
  };
}

/**
 * Destructive-action modal shown when the import target already holds
 * data. Escape cancels. Click outside does NOT cancel, since an
 * accidental dismiss could lose the user's place in the flow. Focus
 * lands on the cancel button by default (safer default for destructive
 * dialogs).
 *
 * IM-05: per-type toggles let the user opt out of replacing specific
 * sections. Lab data is a single combined toggle (covers both LabReport
 * and LabValue) due to the parent/child FK constraint. Confirm is
 * disabled while no toggle is checked, since the strict per-type form
 * with all-false would throw `ImportTargetNotEmptyError` at write time.
 */
export function ConfirmDialog({
  existingCounts,
  targetProfileName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation('import');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Required<PerTypeReplace>>(() =>
    initialSelection(existingCounts),
  );

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

  const anyChecked = useMemo(
    () =>
      selection.observations ||
      selection.labData ||
      selection.supplements ||
      selection.openPoints ||
      selection.timelineEntries ||
      selection.profileVersions,
    [selection],
  );

  const toggle = (key: keyof PerTypeReplace) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelection((prev) => ({ ...prev, [key]: e.target.checked }));
  };

  const hasLabData = existingCounts.labReports > 0 || existingCounts.labValues > 0;

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
          <span aria-hidden>⚠</span> {t('confirm.heading')}
        </h2>
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
          {t('confirm.body', { name: targetProfileName })}
        </p>
        <fieldset className="mb-4 space-y-2 text-sm text-gray-800 dark:text-gray-200">
          <legend className="mb-2 font-medium">{t('confirm.toggle-legend')}</legend>
          {existingCounts.observations > 0 && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selection.observations}
                onChange={toggle('observations')}
                className="h-4 w-4 rounded-sm border-gray-300 text-red-600 focus:ring-red-500 dark:border-gray-600"
              />
              <span>
                {t('confirm.toggle.observations', { count: existingCounts.observations })}
              </span>
            </label>
          )}
          {hasLabData && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selection.labData}
                onChange={toggle('labData')}
                className="h-4 w-4 rounded-sm border-gray-300 text-red-600 focus:ring-red-500 dark:border-gray-600"
              />
              <span>
                {t('confirm.toggle.lab-data', {
                  count: existingCounts.labReports,
                  values: existingCounts.labValues,
                })}
              </span>
            </label>
          )}
          {existingCounts.supplements > 0 && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selection.supplements}
                onChange={toggle('supplements')}
                className="h-4 w-4 rounded-sm border-gray-300 text-red-600 focus:ring-red-500 dark:border-gray-600"
              />
              <span>{t('confirm.toggle.supplements', { count: existingCounts.supplements })}</span>
            </label>
          )}
          {existingCounts.openPoints > 0 && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selection.openPoints}
                onChange={toggle('openPoints')}
                className="h-4 w-4 rounded-sm border-gray-300 text-red-600 focus:ring-red-500 dark:border-gray-600"
              />
              <span>{t('confirm.toggle.open-points', { count: existingCounts.openPoints })}</span>
            </label>
          )}
          {existingCounts.timelineEntries > 0 && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selection.timelineEntries}
                onChange={toggle('timelineEntries')}
                className="h-4 w-4 rounded-sm border-gray-300 text-red-600 focus:ring-red-500 dark:border-gray-600"
              />
              <span>
                {t('confirm.toggle.timeline-entries', { count: existingCounts.timelineEntries })}
              </span>
            </label>
          )}
          {existingCounts.profileVersions > 0 && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selection.profileVersions}
                onChange={toggle('profileVersions')}
                className="h-4 w-4 rounded-sm border-gray-300 text-red-600 focus:ring-red-500 dark:border-gray-600"
              />
              <span>
                {t('confirm.toggle.profile-versions', { count: existingCounts.profileVersions })}
              </span>
            </label>
          )}
        </fieldset>
        <p className="mb-6 text-sm text-red-700 dark:text-red-300">{t('confirm.warning')}</p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('common:action.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selection)}
            disabled={!anyChecked}
            className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400 dark:disabled:bg-gray-700"
          >
            {t('confirm.replace')}
          </button>
        </div>
      </div>
    </div>
  );
}
