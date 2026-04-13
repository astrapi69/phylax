import type { ParsedBaseData } from '../types';
import type { DoctorInfo } from '../../../../domain';
import { parseLabeledBullets } from '../helpers/parseLabeledBullets';
import { parseGermanDate, extractNumber } from '../helpers/parseGermanDate';

/**
 * Parse the Basisdaten section into a ParsedBaseData object.
 *
 * Known labels are mapped to typed fields. Unknown labels are
 * collected into contextNotes preserving original Markdown.
 */
export function parseBasisdaten(content: string): ParsedBaseData {
  const bullets = parseLabeledBullets(content);

  const data: ParsedBaseData = {
    weightHistory: [],
    knownDiagnoses: [],
    currentMedications: [],
    relevantLimitations: [],
  };

  const unknownLines: string[] = [];

  for (const bullet of bullets) {
    const label = bullet.label.toLowerCase();

    if (label === 'geburtsdatum') {
      data.birthDate = parseGermanDate(bullet.value) ?? undefined;
    } else if (label === 'alter') {
      data.age = extractNumber(bullet.value) ?? undefined;
    } else if (label.startsWith('groesse') || label.startsWith('gr\u00f6sse')) {
      data.heightCm = extractNumber(bullet.value) ?? undefined;
    } else if (label === 'gewicht') {
      data.weightKg = extractNumber(bullet.value) ?? undefined;
    } else if (label === 'zielgewicht') {
      data.targetWeightKg = extractNumber(bullet.value) ?? undefined;
    } else if (label === 'hausarzt' || label === 'haus\u00e4rztin') {
      data.primaryDoctor = parseDoctorInfo(bullet.value);
    } else if (label === 'bekannte diagnosen' || label === 'diagnosen') {
      data.knownDiagnoses = splitCommaSeparated(bullet.value);
    } else if (label === 'aktuelle medikamente' || label === 'medikamente') {
      data.currentMedications = splitCommaSeparated(bullet.value);
    } else if (
      label.includes('einschr\u00e4nkung') ||
      label.includes('einschraenkung') ||
      label.includes('limitationen')
    ) {
      data.relevantLimitations = splitCommaSeparated(bullet.value);
    } else if (label === 'gewichtsverlauf') {
      // Too varied to parse into WeightEntry[]; capture as context note
      unknownLines.push(`- **${bullet.label}:** ${bullet.value}`);
    } else {
      unknownLines.push(`- **${bullet.label}:** ${bullet.value}`);
    }
  }

  if (unknownLines.length > 0) {
    data.contextNotes = unknownLines.join('\n');
  }

  return data;
}

function parseDoctorInfo(text: string): DoctorInfo {
  const firstComma = text.indexOf(',');
  if (firstComma === -1) {
    return { name: text.trim() };
  }
  return {
    name: text.substring(0, firstComma).trim(),
    address: text.substring(firstComma + 1).trim(),
  };
}

function splitCommaSeparated(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
