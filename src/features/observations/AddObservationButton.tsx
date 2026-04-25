import { useTranslation } from 'react-i18next';
import type { UseObservationFormResult } from './useObservationForm';

export interface AddObservationButtonProps {
  form: UseObservationFormResult;
}

/**
 * O-10 trigger button on `ObservationsView` header. Opens the form
 * in create mode via the shared `useObservationForm` hook.
 */
export function AddObservationButton({ form }: AddObservationButtonProps) {
  const { t } = useTranslation('observations');
  return (
    <button
      type="button"
      onClick={() => void form.openCreate()}
      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600"
      data-testid="add-observation-btn"
    >
      <span aria-hidden>+</span>
      {t('actions.add')}
    </button>
  );
}
