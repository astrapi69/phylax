import type { ParsedLabReport, ParsedLabValue, ParseWarning } from '../types';
import { splitIntoSections } from '../helpers/splitIntoSections';
import { parseLabeledBullets } from '../helpers/parseLabeledBullets';
import { parseMarkdownTable } from '../helpers/parseMarkdownTable';
import { parseGermanDate } from '../helpers/parseGermanDate';

const REPORT_HEADING_PATTERN = /^Befund\s+vom\s+(.+)/i;
const ASSESSMENT_PATTERN = /\*\*Einsch(?:ae|\u00e4)tzung(?:\s+([^*]+))?\*\*:?\s*(.*)/;
const RELEVANCE_PATTERN = /\*\*Relevanz\s+(?:fuer|f\u00fcr)\s+([^*]+)\*\*:?\s*(.*)/;

/**
 * Parse the Blutwerte section into LabReports and LabValues.
 *
 * Structure: each "### Befund vom <date>" starts a new LabReport.
 * Sub-headings like "### Kleines Blutbild" are value categories.
 * Tables within categories contain the actual LabValues.
 * Bold paragraphs with "Einschaetzung" are category assessments.
 */
export function parseBlutwerte(content: string): {
  labReports: ParsedLabReport[];
  labValues: ParsedLabValue[];
  warnings: ParseWarning[];
} {
  const subsections = splitIntoSections(content, 3);
  const labReports: ParsedLabReport[] = [];
  const labValues: ParsedLabValue[] = [];
  const warnings: ParseWarning[] = [];

  let currentReport: ParsedLabReport | null = null;
  let currentCategory = '';
  let reportIndex = -1;

  for (const sub of subsections) {
    if (sub.level === 0) continue;

    const reportMatch = REPORT_HEADING_PATTERN.exec(sub.heading);
    if (reportMatch) {
      // New lab report
      reportIndex++;
      const dateStr = reportMatch[1]?.trim() ?? '';
      currentReport = {
        reportDate: parseGermanDate(dateStr) ?? dateStr,
        categoryAssessments: {},
      };
      currentCategory = '';

      // Parse labeled bullets for report metadata
      const bullets = parseLabeledBullets(sub.content);
      for (const bullet of bullets) {
        const label = bullet.label.toLowerCase();
        if (label === 'labor') currentReport.labName = bullet.value;
        else if (label === 'arzt' || label === '\u00e4rztin' || label === 'aerztin')
          currentReport.doctorName = bullet.value;
        else if (label.includes('befundnr') || label.includes('nummer'))
          currentReport.reportNumber = bullet.value;
        else if (label.includes('kontext') || label.includes('anlass'))
          currentReport.contextNote = bullet.value;
      }

      // Check for overall assessment and relevance in the content
      parseAssessments(sub.content, currentReport);

      labReports.push(currentReport);
      continue;
    }

    if (!currentReport) {
      // Sub-section before any report heading - try it as a category
      if (sub.heading && sub.content.includes('|')) {
        currentCategory = sub.heading;
        parseValuesFromTable(sub.content, currentCategory, reportIndex, labValues, warnings);
        parseAssessments(sub.content, currentReport);
      }
      continue;
    }

    // Category sub-section within a report
    currentCategory = sub.heading.replace(/\s*\((?:NEU\s+)?v[\d.]+\)\s*/g, '').trim();

    // Parse table rows as lab values
    parseValuesFromTable(sub.content, currentCategory, reportIndex, labValues, warnings);

    // Parse assessments
    parseAssessments(sub.content, currentReport);
  }

  return { labReports, labValues, warnings };
}

function parseValuesFromTable(
  content: string,
  category: string,
  reportIndex: number,
  labValues: ParsedLabValue[],
  _warnings: ParseWarning[],
): void {
  const rows = parseMarkdownTable(content);
  for (const row of rows) {
    const parameter = row['Parameter'] ?? row['parameter'] ?? '';
    const result = row['Ergebnis'] ?? row['ergebnis'] ?? row['Wert'] ?? row['wert'] ?? '';
    if (!parameter) continue;

    labValues.push({
      reportIndex,
      reportId: '', // placeholder, assigned at import
      category,
      parameter: parameter.trim(),
      result: result.trim(),
      unit: (row['Einheit'] ?? row['einheit'] ?? '').trim() || undefined,
      referenceRange:
        (row['Referenz'] ?? row['referenz'] ?? row['Referenzbereich'] ?? '').trim() || undefined,
      assessment: (row['Bewertung'] ?? row['bewertung'] ?? '').trim() || undefined,
    });
  }
}

function parseAssessments(content: string, report: ParsedLabReport | null): void {
  if (!report) return;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    const assessmentMatch = ASSESSMENT_PATTERN.exec(trimmed);
    if (assessmentMatch) {
      const category = assessmentMatch[1]?.trim().replace(/:$/, '');
      const text = assessmentMatch[2]?.trim() ?? '';
      if (category) {
        report.categoryAssessments[category] = text;
      } else {
        report.overallAssessment = text;
      }
      continue;
    }

    const relevanceMatch = RELEVANCE_PATTERN.exec(trimmed);
    if (relevanceMatch) {
      report.relevanceNotes = relevanceMatch[2]?.trim() ?? '';
    }
  }
}
