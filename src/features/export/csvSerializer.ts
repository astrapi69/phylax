/**
 * Tiny RFC-4180-style CSV serializer for the X-06 lab-values CSV
 * export. Hand-rolled because the data is well-bounded (no embedded
 * newlines in lab fields, controlled vocabulary for assessments) and
 * pulling in csv-stringify (~10 KB) or papaparse (~50 KB) for a
 * 7-column tabular export would be disproportionate.
 *
 * Escape rules per cell:
 * - Field contains the separator (`,` or `;`) -> wrap in double quotes.
 * - Field contains a double quote -> double the quote and wrap.
 * - Field contains `\r` or `\n` -> wrap in double quotes.
 * - Empty / undefined cell -> empty string between separators.
 *
 * Output line ending: CRLF (`\r\n`) per RFC 4180, which Excel and
 * most CSV consumers handle uniformly. The BOM (U+FEFF) prefix is
 * the caller's responsibility - csvExport prepends it once at the
 * top of the document.
 */
export type CsvSeparator = ',' | ';';

export function escapeCell(value: string | undefined | null, separator: CsvSeparator): string {
  if (value === undefined || value === null || value === '') return '';
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function serializeRow(
  cells: readonly (string | undefined | null)[],
  separator: CsvSeparator,
): string {
  return cells.map((c) => escapeCell(c, separator)).join(separator);
}

export function serializeCsv(
  rows: readonly (readonly (string | undefined | null)[])[],
  separator: CsvSeparator,
): string {
  return rows.map((r) => serializeRow(r, separator)).join('\r\n');
}
