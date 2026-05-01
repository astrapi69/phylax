import { useTranslation } from 'react-i18next';
import type { LabValue } from '../../domain';
import type { FieldMatch, MatchPlan } from '../../lib';
import { HighlightedText } from '../../ui';
import { LabValueActions } from './LabValueActions';
import type { UseLabValueFormResult } from './useLabValueForm';

interface LabValuesTableProps {
  /** Parent report id; used to scope match-plan keys per cell. */
  reportId: string;
  category: string;
  values: LabValue[];
  /**
   * Optional value-form hook result. When present, each row exposes
   * an edit + delete action cluster in a trailing `<td>`. Omitted in
   * read-only contexts (e.g., profile-view summary panes).
   */
  valueForm?: UseLabValueFormResult;
  /**
   * P-22b/c/d-polish-2: optional match plan keyed by
   * `${reportId}:val:${valueId}:<field>`. When supplied, every
   * matching cell gets a `<mark>` with a sequential global
   * `data-match-index` so the view-level Up/Down nav can scroll
   * per mark.
   */
  matchPlan?: MatchPlan;
  /** Currently focused mark global index (1-based). */
  activeMatchIndex?: number | null;
}

/**
 * Semantic HTML table for lab values in a single category.
 * Responsive via overflow-x-auto wrapper for mobile.
 *
 * O-12b: when a `valueForm` is supplied, an actions column is
 * appended with edit + delete buttons per row.
 */
export function LabValuesTable({
  reportId,
  category,
  values,
  valueForm,
  matchPlan,
  activeMatchIndex = null,
}: LabValuesTableProps) {
  const { t } = useTranslation('lab-values');
  const showActions = !!valueForm;
  const lookup = (valueId: string, field: string): FieldMatch | undefined =>
    matchPlan?.get(`${reportId}:val:${valueId}:${field}`);
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
                <Cell
                  text={v.parameter}
                  fieldMatch={lookup(v.id, 'parameter')}
                  activeMatchIndex={activeMatchIndex}
                />
              </td>
              <td className="py-1.5 pr-4 text-gray-800 dark:text-gray-200">
                <Cell
                  text={v.result}
                  fieldMatch={lookup(v.id, 'result')}
                  activeMatchIndex={activeMatchIndex}
                />
              </td>
              <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">
                <Cell
                  text={v.unit ?? '-'}
                  fieldMatch={lookup(v.id, 'unit')}
                  activeMatchIndex={activeMatchIndex}
                />
              </td>
              <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">
                <Cell
                  text={v.referenceRange ?? '-'}
                  fieldMatch={lookup(v.id, 'reference')}
                  activeMatchIndex={activeMatchIndex}
                />
              </td>
              <td className={`py-1.5 ${assessmentStyle(v.assessment)}`}>
                <Cell
                  text={v.assessment ?? '-'}
                  fieldMatch={lookup(v.id, 'assessment')}
                  activeMatchIndex={activeMatchIndex}
                />
              </td>
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

function Cell({
  text,
  fieldMatch,
  activeMatchIndex,
}: {
  text: string;
  fieldMatch: FieldMatch | undefined;
  activeMatchIndex: number | null;
}) {
  if (!fieldMatch || fieldMatch.ranges.length === 0) return <>{text}</>;
  return (
    <HighlightedText
      text={text}
      ranges={fieldMatch.ranges}
      startMatchIndex={fieldMatch.startIndex}
      activeMatchIndex={activeMatchIndex}
    />
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
