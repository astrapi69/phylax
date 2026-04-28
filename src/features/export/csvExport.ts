import type { TFunction } from 'i18next';
import type { LabReport, LabValue } from '../../domain';
import type { ExportOptions } from './exportOptions';
import { serializeCsv, type CsvSeparator } from './csvSerializer';

/**
 * Lab-values CSV export (X-06). Lab-only scope; a profile's full
 * Markdown / PDF export uses the existing X-01 / X-02 paths.
 *
 * Columns (7, locale-aware headers):
 *   Datum / Date          - parent report.reportDate (ISO YYYY-MM-DD)
 *   Kategorie / Category
 *   Parameter / Parameter
 *   Ergebnis / Result
 *   Einheit / Unit        - empty when absent
 *   Referenz / Reference  - empty when absent
 *   Bewertung / Assessment - empty when absent
 *
 * ROADMAP names 5 columns explicitly (date, parameter, result,
 * reference, assessment); category and unit are added for clinical
 * completeness ("1.5" alone is meaningless without Unit, and
 * Category distinguishes blood / urine / stool panels).
 *
 * Filter composition:
 *   - dateRange: applied (filter parent reports by reportDate, then
 *     keep only values whose reportId survives)
 *   - themes: ignored (lab values have no theme)
 *   - includeLinkedDocuments: ignored (CSV scope is lab values only;
 *     no document appendix in CSV)
 *
 * Locale-aware separator: German CSV consumers (Excel-DE) expect `;`
 * because `,` is the decimal separator. English uses `,`. The
 * U+FEFF BOM is prepended so Excel auto-detects UTF-8.
 *
 * Assessment values are emitted verbatim from the stored value
 * (`erhöht`, `normal`, `erniedrigt`, `kritisch`, or free-text). Lab
 * data is the source of truth; translating at export time would
 * create a surprising mismatch between the in-app view and the CSV.
 * Future i18n refactor of assessment as enum would change this.
 *
 * Sort: parent reportDate descending (newest first), stable secondary
 * sort by `value.id` for determinism.
 *
 * Empty profile: returns header-only CSV (just the BOM + column row).
 * No error, no special UI. Standard CSV convention.
 *
 * X-07 refactor: row construction lives in `buildLabRows()` so the
 * CSV string serialization (download) and the HTML table preview
 * share a single source of truth for column definitions, filtering,
 * and sort order. The CSV path adds the BOM + separator handling on
 * top; the preview path consumes `headers` + `rows` directly.
 */
export interface CsvExportInput {
  labReports: readonly LabReport[];
  labValues: readonly LabValue[];
  t: TFunction<'export'>;
  /** BCP-47 locale tag (e.g. `'de'`, `'en'`). Drives separator choice. */
  locale: string;
  /** Optional date-range filter; only `dateRange` is consulted. */
  options?: ExportOptions;
}

export interface LabRowsInput {
  labReports: readonly LabReport[];
  labValues: readonly LabValue[];
  t: TFunction<'export'>;
  /** Optional date-range filter; only `dateRange` is consulted. */
  options?: ExportOptions;
}

export interface LabRows {
  /** Localized header row (7 cells). */
  headers: readonly string[];
  /** Data rows (7 cells each); already filtered + sorted. */
  rows: readonly (readonly string[])[];
}

const BOM = '\uFEFF';

/**
 * Build the column headers + data rows for the lab-values export.
 * Pure transform: takes domain entities + locale, returns a tabular
 * shape suitable both for CSV string serialization and HTML table
 * rendering. Filtering + sort live here so both paths produce the
 * same content.
 */
export function buildLabRows(input: LabRowsInput): LabRows {
  const { labReports, labValues, t, options = {} } = input;

  // Filter parent reports by date range, then keep values whose
  // reportId survives. Defensive: orphan values (reportId pointing
  // to a missing report) are skipped silently.
  const reportsInRange = filterReportsByDateRange(labReports, options.dateRange);
  const allowedReportIds = new Set(reportsInRange.map((r) => r.id));
  const reportById = new Map(reportsInRange.map((r) => [r.id, r] as const));

  const filteredValues = labValues
    .filter((v) => allowedReportIds.has(v.reportId))
    .sort((a, b) => {
      const ra = reportById.get(a.reportId)?.reportDate ?? '';
      const rb = reportById.get(b.reportId)?.reportDate ?? '';
      const cmp = rb.localeCompare(ra);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

  const headers: string[] = [
    t('csv.col.date'),
    t('csv.col.category'),
    t('csv.col.parameter'),
    t('csv.col.result'),
    t('csv.col.unit'),
    t('csv.col.reference'),
    t('csv.col.assessment'),
  ];
  const rows: string[][] = filteredValues.map((v) => {
    const report = reportById.get(v.reportId);
    return [
      report?.reportDate ?? '',
      v.category,
      v.parameter,
      v.result,
      v.unit ?? '',
      v.referenceRange ?? '',
      v.assessment ?? '',
    ];
  });

  return { headers, rows };
}

export function exportLabValuesAsCsv(input: CsvExportInput): string {
  const { labReports, labValues, t, locale, options } = input;
  const separator = pickSeparator(locale);
  const { headers, rows } = buildLabRows({ labReports, labValues, t, options });
  const allRows: (readonly string[])[] = [headers, ...rows];
  return BOM + serializeCsv(allRows, separator);
}

function pickSeparator(locale: string): CsvSeparator {
  // Match the language tag prefix; `de`, `de-AT`, `de-CH` all use `;`.
  return locale.toLowerCase().startsWith('de') ? ';' : ',';
}

function filterReportsByDateRange(
  reports: readonly LabReport[],
  range: ExportOptions['dateRange'],
): readonly LabReport[] {
  if (!range || (range.from === undefined && range.to === undefined)) return reports;
  const fromMs = range.from?.getTime();
  const toMs = range.to?.getTime();
  return reports.filter((r) => {
    if (!r.reportDate) return true;
    const ms = Date.parse(`${r.reportDate}T00:00:00Z`);
    if (Number.isNaN(ms)) return true;
    if (fromMs !== undefined && ms < fromMs) return false;
    if (toMs !== undefined && ms > toMs) return false;
    return true;
  });
}
