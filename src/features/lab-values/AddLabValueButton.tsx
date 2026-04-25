import { useTranslation } from 'react-i18next';
import type { UseLabValueFormResult } from './useLabValueForm';

export interface AddLabValueButtonProps {
  reportId: string;
  form: UseLabValueFormResult;
}

/**
 * O-12b trigger button on each `LabReportCard` footer. Opens the
 * shared lab-value form in create mode with the parent report's id
 * pre-bound, so the value lands in the right report regardless of
 * which card was clicked.
 *
 * Single button per card (Q3 — not per-category) keeps the surface
 * compact; the user picks category from the form's category datalist.
 */
export function AddLabValueButton({ reportId, form }: AddLabValueButtonProps) {
  const { t } = useTranslation('lab-values');
  return (
    <button
      type="button"
      onClick={() => void form.openCreate(reportId)}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-sm border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-blue-900/30"
      data-testid={`add-lab-value-btn-${reportId}`}
    >
      <span aria-hidden>+</span>
      {t('actions.add-value')}
    </button>
  );
}
