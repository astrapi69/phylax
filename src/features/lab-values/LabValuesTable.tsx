import { useTranslation } from 'react-i18next';
import type { LabValue } from '../../domain';
import { LabValueActions } from './LabValueActions';
import type { UseLabValueFormResult } from './useLabValueForm';

interface LabValuesTableProps {
  category: string;
  values: LabValue[];
  /**
   * Optional value-form hook result. When present, each row exposes
   * an edit + delete action cluster in a trailing `<td>`. Omitted in
   * read-only contexts (e.g., profile-view summary panes).
   */
  valueForm?: UseLabValueFormResult;
}

/**
 * Semantic HTML table for lab values in a single category.
 * Responsive via overflow-x-auto wrapper for mobile.
 *
 * O-12b: when a `valueForm` is supplied, an actions column is
 * appended with edit + delete buttons per row.
 */
export function LabValuesTable({ category, values, valueForm }: LabValuesTableProps) {
  const { t } = useTranslation('lab-values');
  const showActions = !!valueForm;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{category}</caption>
        <thead>
          <tr className="border-b border-gray-200 text-xs font-medium tracking-wide text-gray-500 uppercase dark:border-gray-700 dark:text-gray-400">
            <th scope="col" className="py-2 pr-4">
              {t('table.parameter')}
            </th>
            <th scope="col" className="py-2 pr-4">
              {t('table.result')}
            </th>
            <th scope="col" className="py-2 pr-4">
              {t('table.unit')}
            </th>
            <th scope="col" className="py-2 pr-4">
              {t('table.reference')}
            </th>
            <th scope="col" className="py-2">
              {t('table.assessment')}
            </th>
            {showActions && (
              <th scope="col" className="py-2 pl-2 text-right">
                <span className="sr-only">{t('table.actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {values.map((v) => (
            <tr key={v.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
              <td className="py-1.5 pr-4 font-medium text-gray-900 dark:text-gray-100">
                {v.parameter}
              </td>
              <td className="py-1.5 pr-4 text-gray-800 dark:text-gray-200">{v.result}</td>
              <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">{v.unit ?? '-'}</td>
              <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">
                {v.referenceRange ?? '-'}
              </td>
              <td className={`py-1.5 ${assessmentStyle(v.assessment)}`}>{v.assessment ?? '-'}</td>
              {valueForm && (
                <td className="py-1 pl-2 text-right">
                  <LabValueActions value={v} form={valueForm} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function assessmentStyle(assessment: string | undefined): string {
  if (!assessment) return 'text-gray-600 dark:text-gray-400';
  const lower = assessment.toLowerCase();
  if (lower.includes('kritisch')) {
    return 'text-red-700 dark:text-red-300 font-medium';
  }
  if (lower.includes('erniedrigt') || lower.includes('erhoht') || lower.includes('erhöht')) {
    return 'text-amber-700 dark:text-amber-300 font-medium';
  }
  return 'text-gray-600 dark:text-gray-400';
}
