/**
 * A row from a parsed Markdown table, keyed by column header.
 */
export interface TableRow {
  [column: string]: string;
}

/**
 * Parse a Markdown pipe table into an array of rows.
 *
 * Expected format:
 * ```
 * | Header1 | Header2 | Header3 |
 * |---------|---------|---------|
 * | value1  | value2  | value3  |
 * ```
 *
 * The separator row (dashes) is detected and skipped.
 * Leading/trailing pipes and whitespace are trimmed.
 * Empty rows are skipped.
 *
 * Returns an empty array if the input has no valid table.
 */
export function parseMarkdownTable(markdown: string): TableRow[] {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));

  if (lines.length < 2) return [];

  const headerLine = lines[0];
  if (!headerLine) return [];

  const headers = splitTableRow(headerLine);
  if (headers.length === 0) return [];

  const rows: TableRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Skip separator rows (---|---|---)
    if (/^\|[\s-:|]+\|$/.test(line)) continue;

    const cells = splitTableRow(line);
    const row: TableRow = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        row[header] = cells[j]?.trim() ?? '';
      }
    }
    rows.push(row);
  }

  return rows;
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
