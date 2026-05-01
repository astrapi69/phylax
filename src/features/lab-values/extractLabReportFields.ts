import type { FieldEntry } from '../../lib';
import type { LabReportWithValues } from './useLabValues';

/**
 * Flatten a list of lab reports into a `FieldEntry[]` for
 * `buildFieldMatchPlan`. The order MUST mirror `LabReportCard`'s
 * render order so the cursor assigned to each match matches the
 * visual top-to-bottom reading order; Up/Down nav then follows
 * that order.
 *
 * Render order (per report, repeated newest-first across reports):
 *   1. Header meta: labName, doctorName, reportNumber
 *   2. contextNote (Markdown, separate block above the values)
 *   3. Categories loop (insertion order of `valuesByCategory`):
 *      a. Category heading (plain text)
 *      b. Per value in row order: parameter, result, unit,
 *         referenceRange, assessment
 *      c. CategoryAssessment (Markdown)
 *   4. overallAssessment (Markdown)
 *   5. relevanceNotes (Markdown)
 *
 * Optional fields are emitted only when present so the cursor stays
 * tight (no zero-mark fields wasting plan slots). Filter coverage
 * (`filterLabReports.matchesAnyField`) and matchPlan coverage MUST
 * stay aligned: a field that the filter searches must also be
 * scanned by the plan, otherwise a retained report could end up
 * with zero marks.
 */
export function extractLabReportFields(reports: LabReportWithValues[]): FieldEntry[] {
  const fields: FieldEntry[] = [];
  for (const { report, valuesByCategory } of reports) {
    if (report.labName) {
      fields.push({ key: `${report.id}:labName`, text: report.labName });
    }
    if (report.doctorName) {
      fields.push({ key: `${report.id}:doctorName`, text: report.doctorName });
    }
    if (report.reportNumber) {
      fields.push({ key: `${report.id}:reportNumber`, text: report.reportNumber });
    }
    if (report.contextNote && report.contextNote.trim() !== '') {
      fields.push({ key: `${report.id}:contextNote`, text: report.contextNote });
    }

    for (const [category, values] of valuesByCategory.entries()) {
      fields.push({ key: `${report.id}:cat:${category}:heading`, text: category });
      for (const v of values) {
        fields.push({ key: `${report.id}:val:${v.id}:parameter`, text: v.parameter });
        fields.push({ key: `${report.id}:val:${v.id}:result`, text: v.result });
        if (v.unit) {
          fields.push({ key: `${report.id}:val:${v.id}:unit`, text: v.unit });
        }
        if (v.referenceRange) {
          fields.push({ key: `${report.id}:val:${v.id}:reference`, text: v.referenceRange });
        }
        if (v.assessment) {
          fields.push({ key: `${report.id}:val:${v.id}:assessment`, text: v.assessment });
        }
      }
      const ca = report.categoryAssessments[category];
      if (ca && ca.trim() !== '') {
        fields.push({ key: `${report.id}:cat:${category}:assessment`, text: ca });
      }
    }

    if (report.overallAssessment && report.overallAssessment.trim() !== '') {
      fields.push({ key: `${report.id}:overall`, text: report.overallAssessment });
    }
    if (report.relevanceNotes && report.relevanceNotes.trim() !== '') {
      fields.push({ key: `${report.id}:relevance`, text: report.relevanceNotes });
    }
  }
  return fields;
}
