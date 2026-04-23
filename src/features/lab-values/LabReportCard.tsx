import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LabReport, LabValue } from '../../domain';
import { MarkdownContent } from '../profile-view';
import { CategoryAssessment } from './CategoryAssessment';
import { LabValuesTable } from './LabValuesTable';
import { AttachedDocumentsForLabReport } from '../documents/AttachedDocumentsForLabReport';

interface LabReportCardProps {
  report: LabReport;
  valuesByCategory: Map<string, LabValue[]>;
}

/**
 * Single lab report card: header metadata, per-category values
 * tables with assessments, overall assessment, and relevance notes.
 */
export function LabReportCard({ report, valuesByCategory }: LabReportCardProps) {
  const { t } = useTranslation('lab-values');
  const {
    reportDate,
    labName,
    doctorName,
    reportNumber,
    contextNote,
    categoryAssessments,
    overallAssessment,
    relevanceNotes,
  } = report;

  const formattedDate = formatGermanDate(reportDate);
  const categories = Array.from(valuesByCategory.entries());
  const allValues = useMemo(() => Array.from(valuesByCategory.values()).flat(), [valuesByCategory]);

  return (
    <section
      aria-labelledby={`report-${report.id}-heading`}
      className="rounded-sm border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <header className="border-b border-gray-200 p-4 dark:border-gray-700">
        <h2
          id={`report-${report.id}-heading`}
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {t('report.heading', { date: formattedDate })}
        </h2>
        <dl className="mt-1 space-y-0.5 text-sm text-gray-600 dark:text-gray-400">
          {labName && <MetaItem label={t('report.meta.lab')} value={labName} />}
          {doctorName && <MetaItem label={t('report.meta.doctor')} value={doctorName} />}
          {reportNumber && <MetaItem label={t('report.meta.report-number')} value={reportNumber} />}
        </dl>
      </header>

      {contextNote && (
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <MarkdownContent>{contextNote}</MarkdownContent>
        </div>
      )}

      <div className="space-y-6 p-4">
        {categories.map(([category, values]) => (
          <div key={category}>
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              {category}
            </h3>
            <LabValuesTable category={category} values={values} />
            <CategoryAssessment category={category} assessment={categoryAssessments[category]} />
          </div>
        ))}

        {overallAssessment && overallAssessment.trim() !== '' && (
          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('report.section.overall')}
            </h3>
            <MarkdownContent>{overallAssessment}</MarkdownContent>
          </div>
        )}

        {relevanceNotes && relevanceNotes.trim() !== '' && (
          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('report.section.relevance')}
            </h3>
            <MarkdownContent>{relevanceNotes}</MarkdownContent>
          </div>
        )}

        <AttachedDocumentsForLabReport values={allValues} />
      </div>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="font-medium">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatGermanDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
