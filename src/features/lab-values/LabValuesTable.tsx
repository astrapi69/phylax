import type { LabValue } from '../../domain';

interface LabValuesTableProps {
  category: string;
  values: LabValue[];
}

/**
 * Semantic HTML table for lab values in a single category.
 * Responsive via overflow-x-auto wrapper for mobile.
 */
export function LabValuesTable({ category, values }: LabValuesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{category}</caption>
        <thead>
          <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th scope="col" className="py-2 pr-4">
              Parameter
            </th>
            <th scope="col" className="py-2 pr-4">
              Ergebnis
            </th>
            <th scope="col" className="py-2 pr-4">
              Einheit
            </th>
            <th scope="col" className="py-2 pr-4">
              Referenz
            </th>
            <th scope="col" className="py-2">
              Bewertung
            </th>
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
  if (lower.includes('erniedrigt') || lower.includes('erhoht') || lower.includes('erhöht')) {
    return 'text-amber-700 dark:text-amber-300 font-medium';
  }
  return 'text-gray-600 dark:text-gray-400';
}
