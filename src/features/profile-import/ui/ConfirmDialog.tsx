import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog as O20ConfirmDialog } from '../../../ui';
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
 * data. Composes the shared `<ConfirmDialog>` from `src/ui/Modal/`
 * (O-20 / TD-12 migration): focus trap, Escape close, backdrop, and
 * destructive-variant chrome (red confirm button + role="alertdialog")
 * are provided by the primitive. Body slot carries the per-type
 * toggle fieldset specific to IM-05.
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
  const [selection, setSelection] = useState<Required<PerTypeReplace>>(() =>
    initialSelection(existingCounts),
  );

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
    <O20ConfirmDialog
      open
      onClose={onCancel}
      title={t('confirm.heading')}
      body={
        <>
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
            {t('confirm.body', { name: targetProfileName })}
          </p>
          <fieldset className="mb-4 space-y-2">
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
                <span>
                  {t('confirm.toggle.supplements', { count: existingCounts.supplements })}
                </span>
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
                <span>
                  {t('confirm.toggle.open-points', { count: existingCounts.openPoints })}
                </span>
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
          <p className="text-sm text-red-700 dark:text-red-300">{t('confirm.warning')}</p>
        </>
      }
      cancelLabel={t('common:action.cancel')}
      confirmLabel={t('confirm.replace')}
      onConfirm={() => onConfirm(selection)}
      variant="destructive"
      confirmDisabled={!anyChecked}
    />
  );
}
