import { useTranslation } from 'react-i18next';
import type { UseOpenPointFormResult } from './useOpenPointForm';

export interface AddOpenPointButtonProps {
  form: UseOpenPointFormResult;
}

/**
 * O-15 trigger button on the OpenPointsView header. Opens the form
 * in create mode via the shared `useOpenPointForm` hook. Always
 * rendered — empty-state surfaces still expose the button so users
 * can add their first item.
 */
export function AddOpenPointButton({ form }: AddOpenPointButtonProps) {
  const { t } = useTranslation('open-points');
  return (
    <button
      type="button"
      onClick={() => void form.openCreate()}
      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600"
      data-testid="add-open-point-btn"
    >
      <span aria-hidden>+</span>
      {t('actions.add')}
    </button>
  );
}
