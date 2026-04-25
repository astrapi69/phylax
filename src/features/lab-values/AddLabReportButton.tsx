import { useTranslation } from 'react-i18next';
import type { UseLabReportFormResult } from './useLabReportForm';

export interface AddLabReportButtonProps {
  form: UseLabReportFormResult;
}

/**
 * O-12a trigger button on `LabValuesView` header. Opens the form in
 * create mode via the shared `useLabReportForm` hook.
 */
export function AddLabReportButton({ form }: AddLabReportButtonProps) {
  const { t } = useTranslation('lab-values');
  return (
    <button
      type="button"
      onClick={() => form.openCreate()}
      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600"
      data-testid="add-lab-report-btn"
    >
      <span aria-hidden>+</span>
      {t('actions.add-report')}
    </button>
  );
}
