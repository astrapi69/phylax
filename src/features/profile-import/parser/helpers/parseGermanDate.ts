const GERMAN_MONTHS: Record<string, string> = {
  januar: '01',
  februar: '02',
  maerz: '03',
  april: '04',
  mai: '05',
  juni: '06',
  juli: '07',
  august: '08',
  september: '09',
  oktober: '10',
  november: '11',
  dezember: '12',
};

/**
 * Parse a German date string into ISO format (YYYY-MM-DD).
 *
 * Recognized formats:
 * - "28.08.1969" -> "1969-08-28"
 * - "Dezember 2024" -> "2024-12-01" (month-only, day defaults to 01)
 * - "Maerz 2026" -> "2026-03-01"
 * - "15.12.2024" -> "2024-12-15"
 *
 * Returns null for unrecognized formats.
 * Does not guess century for two-digit years (e.g., "28.08.69" -> null).
 */
export function parseGermanDate(text: string): string | null {
  const trimmed = text.trim();

  // DD.MM.YYYY format
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = (dmy[1] ?? '').padStart(2, '0');
    const month = (dmy[2] ?? '').padStart(2, '0');
    const year = dmy[3] ?? '';
    return `${year}-${month}-${day}`;
  }

  // "Month YYYY" format (German month names)
  const monthYear = /^([A-Za-z\u00e4\u00f6\u00fc]+)\s+(\d{4})$/.exec(trimmed);
  if (monthYear) {
    const monthName = (monthYear[1] ?? '').toLowerCase();
    const year = monthYear[2] ?? '';
    const monthNum = GERMAN_MONTHS[monthName];
    if (monthNum) {
      return `${year}-${monthNum}-01`;
    }
  }

  return null;
}

/**
 * Extract a number from text, handling German formatting.
 * "56 Jahre" -> 56, "183 cm" -> 183, "92 kg" -> 92, "92,5" -> 92.5
 * Returns null if no number found.
 */
export function extractNumber(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)/.exec(text);
  if (!match?.[1]) return null;
  return parseFloat(match[1].replace(',', '.'));
}
