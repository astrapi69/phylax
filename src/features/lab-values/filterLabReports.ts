import {
  isDateRangeActive,
  isInDateRangeIso,
  normalizeForSearch,
  type DateRange,
} from '../../lib';
import type { LabReportWithValues } from './useLabValues';

/**
 * Filter lab reports by an optional date range applied to
 * `reportDate` AND an optional search query whose terms must all
 * match (AND across whitespace-split terms).
 *
 * Q10 row-keep semantic: a report is retained when EITHER any of
 * its header fields matches the query OR any of its child values
 * matches. When retained, ALL the report's values render
 * unchanged — the table row layout is preserved so neighbour
 * values stay visible for clinical context. Highlighting (handled
 * by the rendering layer, not this filter) shows only the actual
 * matches.
 *
 * Search haystack (Q-lock):
 *   - report header: `labName`, `doctorName`, `reportNumber`,
 *     `contextNote`, `overallAssessment`, `relevanceNotes`,
 *     plus every per-category assessment string
 *   - lab value: `parameter`, `category`, `result`, `unit`,
 *     `referenceRange`, `assessment`
 *
 * Date filter applies first (cheaper); search applies to the
 * already-date-filtered set so combined filter behaves AND.
 *
 * Empty / whitespace-only query AND empty date range pass through
 * unchanged. Either filter being active narrows the result.
 *
 * `matchCount` counts retained reports (not individual cell
 * matches) — sufficient for the "X von Y Befunden" header counter.
 * Cell-level match counting + Browser-Find Up/Down nav lives in a
 * P-22b-polish follow-up if a real use case surfaces.
 */
export interface FilterLabReportsOptions {
  query?: string;
  dateRange?: DateRange;
}

export interface FilterLabReportsResult {
  reports: LabReportWithValues[];
  matchCount: number;
  totalCount: number;
}

export function filterLabReports(
  reports: LabReportWithValues[],
  options: FilterLabReportsOptions = {},
): FilterLabReportsResult {
  const query = options.query ?? '';
  const dateRange = options.dateRange ?? {};
  const dateActive = isDateRangeActive(dateRange);

  const totalCount = reports.length;

  const trimmed = query.trim();
  const terms =
    trimmed === ''
      ? []
      : trimmed
          .split(/\s+/)
          .map(normalizeForSearch)
          .filter((t) => t.length > 0);

  if (terms.length === 0 && !dateActive) {
    return { reports, matchCount: totalCount, totalCount };
  }

  const dateFiltered = dateActive
    ? reports.filter(({ report }) => isInDateRangeIso(report.reportDate, dateRange))
    : reports;

  if (terms.length === 0) {
    return { reports: dateFiltered, matchCount: dateFiltered.length, totalCount };
  }

  const matched = dateFiltered.filter((rwv) => matchesAnyField(rwv, terms));
  return { reports: matched, matchCount: matched.length, totalCount };
}

function matchesAnyField({ report, valuesByCategory }: LabReportWithValues, terms: string[]): boolean {
  // Build a single haystack per report covering header + every
  // value cell + every category-assessment + the category names
  // themselves. AND-combine terms over the joined haystack so a
  // multi-term query like "Synlab Kreatinin" matches a report
  // whose lab name is "Synlab" and that contains a "Kreatinin"
  // value, even though those tokens are in different fields.
  const headerParts: string[] = [
    report.labName ?? '',
    report.doctorName ?? '',
    report.reportNumber ?? '',
    report.contextNote ?? '',
    report.overallAssessment ?? '',
    report.relevanceNotes ?? '',
    ...Object.values(report.categoryAssessments),
  ];

  const valueParts: string[] = [];
  for (const [category, values] of valuesByCategory.entries()) {
    valueParts.push(category);
    for (const v of values) {
      valueParts.push(v.parameter, v.result);
      if (v.unit) valueParts.push(v.unit);
      if (v.referenceRange) valueParts.push(v.referenceRange);
      if (v.assessment) valueParts.push(v.assessment);
    }
  }

  const haystack = [...headerParts, ...valueParts].map(normalizeForSearch).join('\n');
  return terms.every((term) => haystack.includes(term));
}
