import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LabReport, LabValue } from '../../domain';
import type { FieldMatch, MatchPlan } from '../../lib';
import { HighlightedText } from '../../ui';
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
  /**
   * Optional search query for P-22b in-cell highlighting. When set,
   * plain-text fields (lab name, doctor name, value cells) wrap
   * matching substrings in `<mark>` via `<HighlightedText>`, and
   * Markdown fields (contextNote, overallAssessment, relevanceNotes,
   * categoryAssessments) thread the query through `<MarkdownContent>`'s
   * `highlightQuery` prop. Empty / whitespace-only renders unchanged.
   * Read-only mounts (profile-view summary) omit the prop and behave
   * exactly as before.
   */
  highlightQuery?: string;
  /**
   * P-22b/c/d-polish-2: optional match plan from
   * `buildFieldMatchPlan` keyed by `${reportId}:<fieldKey>`. When
   * supplied, every rendered mark gets a sequential global
   * `data-match-index` so the view-level Up/Down nav can
   * `scrollIntoView` per mark. Omitted in read-only mounts; per-cell
   * highlight ranges still render but with `startMatchIndex=0`
   * (inert global indices, no nav).
   */
  matchPlan?: MatchPlan;
  /** Currently focused mark global index (1-based). Null means no
   *  active mark and `<HighlightedText>` paints all marks passively. */
  activeMatchIndex?: number | null;
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
export function LabReportCard({
  report,
  valuesByCategory,
  form,
  valueForm,
  highlightQuery,
  matchPlan,
  activeMatchIndex = null,
}: LabReportCardProps) {
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
  const lookup = (key: string): FieldMatch | undefined => matchPlan?.get(`${report.id}:${key}`);

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
            {labName && (
              <MetaItem
                label={t('report.meta.lab')}
                value={labName}
                fieldMatch={lookup('labName')}
                activeMatchIndex={activeMatchIndex}
              />
            )}
            {doctorName && (
              <MetaItem
                label={t('report.meta.doctor')}
                value={doctorName}
                fieldMatch={lookup('doctorName')}
                activeMatchIndex={activeMatchIndex}
              />
            )}
            {reportNumber && (
              <MetaItem
                label={t('report.meta.report-number')}
                value={reportNumber}
                fieldMatch={lookup('reportNumber')}
                activeMatchIndex={activeMatchIndex}
              />
            )}
          </dl>
        </div>
        {form ? <LabReportActions report={report} form={form} /> : null}
      </header>

      {contextNote && contextNote.trim() !== '' && (
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <MarkdownContent
            highlightQuery={highlightQuery}
            startMatchIndex={lookup('contextNote')?.startIndex ?? 0}
            activeMatchIndex={activeMatchIndex}
          >
            {contextNote}
          </MarkdownContent>
        </div>
      )}

      <div className="space-y-6 p-4">
        {hasValues ? (
          categories.map(([category, values]) => (
            <div key={category}>
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                <HighlightCell
                  text={category}
                  fieldMatch={lookup(`cat:${category}:heading`)}
                  activeMatchIndex={activeMatchIndex}
                />
              </h3>
              <LabValuesTable
                reportId={report.id}
                category={category}
                values={values}
                valueForm={valueForm}
                matchPlan={matchPlan}
                activeMatchIndex={activeMatchIndex}
              />
              <CategoryAssessment
                category={category}
                assessment={categoryAssessments[category]}
                highlightQuery={highlightQuery}
                startMatchIndex={lookup(`cat:${category}:assessment`)?.startIndex ?? 0}
                activeMatchIndex={activeMatchIndex}
              />
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
            <MarkdownContent
              highlightQuery={highlightQuery}
              startMatchIndex={lookup('overall')?.startIndex ?? 0}
              activeMatchIndex={activeMatchIndex}
            >
              {overallAssessment}
            </MarkdownContent>
          </div>
        )}

        {relevanceNotes && relevanceNotes.trim() !== '' && (
          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('report.section.relevance')}
            </h3>
            <MarkdownContent
              highlightQuery={highlightQuery}
              startMatchIndex={lookup('relevance')?.startIndex ?? 0}
              activeMatchIndex={activeMatchIndex}
            >
              {relevanceNotes}
            </MarkdownContent>
          </div>
        )}

        <AttachedDocumentsForLabReport values={allValues} />
      </div>
    </section>
  );
}

function MetaItem({
  label,
  value,
  fieldMatch,
  activeMatchIndex,
}: {
  label: string;
  value: string;
  fieldMatch: FieldMatch | undefined;
  activeMatchIndex: number | null;
}) {
  return (
    <div className="flex gap-1">
      <dt className="font-medium">{label}:</dt>
      <dd>
        <HighlightCell text={value} fieldMatch={fieldMatch} activeMatchIndex={activeMatchIndex} />
      </dd>
    </div>
  );
}

/**
 * Wraps a plain-text string with `<HighlightedText>` when the field
 * has a match plan entry; otherwise renders the bare string. Each
 * mark gets a sequential global `data-match-index` derived from the
 * plan's `startIndex` so the view-level Up/Down nav can scroll to
 * the right `<mark>`. P-22b/c/d-polish-2 swap from per-cell ranges
 * + zero-index marks (inert) to plan-driven global indices
 * (navigable).
 */
function HighlightCell({
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

function formatGermanDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
