import { useTranslation } from 'react-i18next';
import type { Profile } from '../../domain';
import type { UseProfileBaseDataFormResult } from './useProfileBaseDataForm';

export interface EditBaseDataButtonProps {
  profile: Profile;
  form: UseProfileBaseDataFormResult;
}

/**
 * Inline section-level edit trigger placed inside `BaseDataSection`.
 * Clicking opens the base-data form modal in edit mode.
 *
 * Section-scoped placement (rather than a header-level "Profil
 * bearbeiten" button) communicates which slice of the profile is
 * being edited. Future E-series tasks add similar inline buttons to
 * the doctor / weight-history / warning-signs / etc. sections.
 *
 * 44x44 touch target per WCAG 2.5.5.
 */
export function EditBaseDataButton({ profile, form }: EditBaseDataButtonProps) {
  const { t } = useTranslation('profile-view');
  return (
    <button
      type="button"
      onClick={() => form.openEdit(profile)}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-sm border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      data-testid="edit-base-data-btn"
    >
      <PencilIcon />
      {t('basedata.edit-button')}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9zm0 1.41L3 11.41V13h1.59l8.5-8.5L11.5 2.91z" />
    </svg>
  );
}
