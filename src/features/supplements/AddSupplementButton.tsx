import { useTranslation } from 'react-i18next';
import type { UseSupplementFormResult } from './useSupplementForm';

export interface AddSupplementButtonProps {
  form: UseSupplementFormResult;
}

/**
 * O-14 trigger button on the `SupplementsView` header. Opens the form
 * in create mode via the shared `useSupplementForm` hook. Always
 * rendered regardless of populated state - empty-state surfaces still
 * show the button so users can add their first supplement.
 */
export function AddSupplementButton({ form }: AddSupplementButtonProps) {
  const { t } = useTranslation('supplements');
  return (
    <button
      type="button"
      onClick={() => form.openCreate()}
      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600"
      data-testid="add-supplement-btn"
    >
      <span aria-hidden>+</span>
      {t('actions.add')}
    </button>
  );
}
