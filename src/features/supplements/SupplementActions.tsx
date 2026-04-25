import { useTranslation } from 'react-i18next';
import type { Supplement } from '../../domain';
import type { UseSupplementFormResult } from './useSupplementForm';

export interface SupplementActionsProps {
  supplement: Supplement;
  form: UseSupplementFormResult;
}

/**
 * O-14 per-card edit + delete cluster shown trailing the
 * `SupplementCard` title row. Always visible (no hover-only) for
 * touch + keyboard accessibility. `min-h-[44px]` per WCAG 2.5.5 AAA
 * touch target, matching the O-10 / O-12a / O-12b precedents on
 * `ObservationActions`, `LabReportActions`, `LabValueActions`.
 *
 * `flex-shrink-0` keeps the cluster pinned to the right edge as the
 * variable-width title row content (name + brand + paused badge +
 * ProvenanceBadge) flexes around it.
 */
export function SupplementActions({ supplement, form }: SupplementActionsProps) {
  const { t } = useTranslation('supplements');

  return (
    <div className="flex flex-shrink-0 items-center gap-1" data-testid="supplement-actions">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.openEdit(supplement);
        }}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm px-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        title={t('actions.edit')}
        aria-label={t('actions.edit-supplement', { name: supplement.name })}
        data-testid={`supplement-edit-btn-${supplement.id}`}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.openDelete(supplement);
        }}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm px-2 text-sm text-red-700 hover:bg-red-50 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-300 dark:hover:bg-red-900/30"
        title={t('actions.delete')}
        aria-label={t('actions.delete-supplement', { name: supplement.name })}
        data-testid={`supplement-delete-btn-${supplement.id}`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9zm0 1.41L3 11.41V13h1.59l8.5-8.5L11.5 2.91z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M5.5 1h5l.5 1H14v1H2V2h3l.5-1zM3.5 4h9l-.6 10a1 1 0 0 1-1 1H5.1a1 1 0 0 1-1-1L3.5 4zm2 2v7h1V6h-1zm3 0v7h1V6h-1z" />
    </svg>
  );
}
