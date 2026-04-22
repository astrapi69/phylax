import type { ParsedProfileVersion } from '../types';
import { parseMarkdownTable } from '../helpers/parseMarkdownTable';
import { parseGermanDate } from '../helpers/parseGermanDate';

/**
 * Parse the Versionshistorie table into ProfileVersion entities.
 *
 * Expected columns: Version, Datum, Aenderung (or close variants).
 * changeDate is parsed from German date formats (DD.MM.YYYY or "Month Year").
 */
export function parseVersionshistorie(content: string): ParsedProfileVersion[] {
  const rows = parseMarkdownTable(content);
  const versions: ParsedProfileVersion[] = [];

  for (const row of rows) {
    const version = (row['Version'] ?? row['version'] ?? '').trim();
    const rawDate = (row['Datum'] ?? row['datum'] ?? row['Date'] ?? row['date'] ?? '').trim();
    const changeDescription = // TD-09 (a): accept both ASCII transliteration and Unicode forms.
    (
      row['Aenderung'] ??
      row['\u00c4nderung'] ??
      row['aenderung'] ??
      row['\u00e4nderung'] ??
      row['Beschreibung'] ??
      ''
    ).trim();

    if (!version && !changeDescription) continue;

    versions.push({
      version: version || 'unknown',
      changeDate: parseGermanDate(rawDate) ?? rawDate,
      changeDescription,
    });
  }

  return versions;
}
