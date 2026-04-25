import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LabReport, LabValue } from '../../domain';
import { MarkdownContent } from '../profile-view';
import { CategoryAssessment } from './CategoryAssessment';
import { LabValuesTable } from './LabValuesTable';
import { AttachedDocumentsForLabReport } from '../documents/AttachedDocumentsForLabReport';
import { ProvenanceBadge } from '../document-import/ui/ProvenanceBadge';
import { LabReportActions } from './LabReportActions';
import { AddLabValueButton } from './AddLabValueButton';
import type { UseLabReportFormResult } from './useLabReportForm';
import type { UseLabValueFormResult } from './useLabValueForm';

interface LabReportCardProps {
  report: LabReport;
  valuesByCategory: Map<string, LabValue[]>;
  /**
   * Optional report-form hook result. When omitted, no edit/delete
   * actions render — keeps the card usable in read-only contexts
   * (e.g., profile-view summary panes) without requiring a form
   * provider in the surrounding tree.
   */
  form?: UseLabReportFormResult;
  /**
   * Optional value-form hook result. When supplied, each row in the
   * values table exposes edit/delete actions and the card footer
   * shows an "Add value" button bound to this report. O-12b parity
   * with the report-level `form` prop.
   */
  valueForm?: UseLabValueFormResult;
}

/**
 * Single lab report card: header metadata, per-category values
 * tables with assessments, overall assessment, and relevance notes.
 *
 * O-12a: when a `form` prop is supplied, the header shows the
 * edit/delete actions cluster. Empty reports (no values yet) render
 * header-only with a "Keine Werte erfasst" placeholder so the
 * report shell is visible while users add values incrementally.
 */
export function LabReportCard({ report, valuesByCategory, form, valueForm }: LabReportCardProps) {
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
  const hasValues = categories.length > 0;
  const allValues = useMemo(() => Array.from(valuesByCategory.values()).flat(), [valuesByCategory]);

  return (
    <section
      aria-labelledby={`report-${report.id}-heading`}
      className="rounded-sm border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <header className="flex items-start justify-between gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2
              id={`report-${report.id}-heading`}
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {t('report.heading', { date: formattedDate })}
            </h2>
            <ProvenanceBadge sourceDocumentId={report.sourceDocumentId} />
          </div>
          <dl className="mt-1 space-y-0.5 text-sm text-gray-600 dark:text-gray-400">
            {labName && <MetaItem label={t('report.meta.lab')} value={labName} />}
            {doctorName && <MetaItem label={t('report.meta.doctor')} value={doctorName} />}
            {reportNumber && (
              <MetaItem label={t('report.meta.report-number')} value={reportNumber} />
            )}
          </dl>
        </div>
        {form ? <LabReportActions report={report} form={form} /> : null}
      </header>

      {contextNote && (
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <MarkdownContent>{contextNote}</MarkdownContent>
        </div>
      )}

      <div className="space-y-6 p-4">
        {hasValues ? (
          categories.map(([category, values]) => (
            <div key={category}>
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                {category}
              </h3>
              <LabValuesTable category={category} values={values} valueForm={valueForm} />
              <CategoryAssessment category={category} assessment={categoryAssessments[category]} />
            </div>
          ))
        ) : (
          <p
            className="text-sm text-gray-500 italic dark:text-gray-400"
            data-testid={`lab-report-${report.id}-no-values`}
          >
            {t('report.no-values')}
          </p>
        )}

        {valueForm && (
          <div
            className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700"
            data-testid={`lab-report-${report.id}-add-value-footer`}
          >
            <AddLabValueButton reportId={report.id} form={valueForm} />
          </div>
        )}

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
