import type {
  Profile,
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  WeightEntry,
} from '../../../domain';
import { getDisplayName } from '../../../domain';

/**
 * Inputs for the rich "share profile" summary sent into the chat.
 *
 * The caller is responsible for loading and pre-filtering:
 * - `observations` is the full list; the formatter groups by theme.
 * - `latestReport` is the most recent LabReport (or null if none exist).
 * - `latestReportValues` are the LabValue rows linked to `latestReport`;
 *   the formatter applies the abnormal-assessment filter.
 * - `supplements` is the full list; the formatter shows all categories.
 * - `unresolvedOpenPoints` must already exclude resolved points.
 */
export interface ProfileShareInputs {
  profile: Profile;
  observations: Observation[];
  latestReport: LabReport | null;
  latestReportValues: LabValue[];
  supplements: Supplement[];
  unresolvedOpenPoints: OpenPoint[];
}

/**
 * Summary counts surfaced alongside the formatted Markdown so the UI can
 * render a compact preview (collapsed card) without re-parsing the output.
 */
export interface ProfileShareCounts {
  observationCount: number;
  abnormalLabCount: number;
  supplementCount: number;
  openPointCount: number;
  warningSignCount: number;
}

export interface ProfileShareResult {
  markdown: string;
  counts: ProfileShareCounts;
}

const FIELD_TRUNCATION_CHARS = 200;

const CATEGORY_LABEL: Record<Supplement['category'], string> = {
  daily: 'taeglich',
  regular: 'regelmaessig',
  'on-demand': 'bei Bedarf',
  paused: 'pausiert',
};

const NORMAL_ASSESSMENTS = new Set([
  'normal',
  'unauffaellig',
  'unauffällig',
  'ok',
  'in ordnung',
  'im normbereich',
]);

const GERMAN_MONTHS = [
  'Jan',
  'Feb',
  'Maerz',
  'Apr',
  'Mai',
  'Juni',
  'Juli',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

/**
 * Compact Markdown digest of a user's health profile, tuned for AI
 * consumption. Omits empty sections, truncates verbose observation fields
 * to FIELD_TRUNCATION_CHARS, and filters lab values to abnormal only.
 *
 * The return carries both the Markdown string (to be inserted into the
 * chat as a context message) and a counts object (used by the UI card
 * to render a collapsed summary without parsing the output).
 */
export function formatProfileShareSummary(inputs: ProfileShareInputs): ProfileShareResult {
  const { profile, observations, latestReport, latestReportValues } = inputs;
  const { supplements, unresolvedOpenPoints } = inputs;

  const abnormalValues = latestReportValues.filter(isAbnormal);

  const lines: string[] = [];

  lines.push(`# Profil: ${getDisplayName(profile)}`);
  if (profile.baseData.profileType === 'proxy') {
    const caregiver = profile.baseData.managedBy?.trim();
    lines.push(`Gefuehrt von: ${caregiver ? caregiver : '(nicht angegeben)'}`);
  }

  appendBaseData(lines, profile);
  appendObservations(lines, observations);
  appendLabValues(lines, latestReport, abnormalValues);
  appendSupplements(lines, supplements);
  appendOpenPoints(lines, unresolvedOpenPoints);
  appendWarningSigns(lines, profile.warningSigns);

  const markdown = lines.join('\n');

  return {
    markdown,
    counts: {
      observationCount: observations.length,
      abnormalLabCount: abnormalValues.length,
      supplementCount: supplements.length,
      openPointCount: unresolvedOpenPoints.length,
      warningSignCount: profile.warningSigns.length,
    },
  };
}

function appendBaseData(lines: string[], profile: Profile): void {
  const bd = profile.baseData;
  const items: string[] = [];

  if (typeof bd.age === 'number') items.push(`- Alter: ${bd.age} Jahre`);
  if (typeof bd.heightCm === 'number') items.push(`- Groesse: ${bd.heightCm} cm`);

  if (typeof bd.weightKg === 'number') {
    const target = typeof bd.targetWeightKg === 'number' ? ` (Ziel: ${bd.targetWeightKg} kg)` : '';
    items.push(`- Gewicht: ${bd.weightKg} kg${target}`);
  }

  const weightTrend = formatWeightTrend(bd.weightHistory);
  if (weightTrend) items.push(`- Gewichtsverlauf: ${weightTrend}`);

  if (bd.knownDiagnoses.length > 0) {
    items.push(`- Bekannte Diagnosen: ${bd.knownDiagnoses.join(', ')}`);
  }
  if (bd.currentMedications.length > 0) {
    items.push(`- Aktuelle Medikamente: ${bd.currentMedications.join(', ')}`);
  }
  if (bd.relevantLimitations.length > 0) {
    items.push(`- Einschraenkungen: ${bd.relevantLimitations.join(', ')}`);
  }
  if (bd.primaryDoctor) {
    const specialty = bd.primaryDoctor.specialty ? ` (${bd.primaryDoctor.specialty})` : '';
    items.push(`- Hausarzt/Aerztin: ${bd.primaryDoctor.name}${specialty}`);
  }

  if (items.length === 0) return;
  lines.push('', '## Basisdaten', ...items);
}

function appendObservations(lines: string[], observations: Observation[]): void {
  // Skip observations whose four core fields are all empty - the theme
  // name alone is no signal and a bare `### Theme` header would be noise.
  const nonEmpty = observations.filter(hasObservationContent);
  if (nonEmpty.length === 0) return;

  const collator = new Intl.Collator('de');
  const byTheme = new Map<string, Observation[]>();
  for (const obs of nonEmpty) {
    const list = byTheme.get(obs.theme);
    if (list) list.push(obs);
    else byTheme.set(obs.theme, [obs]);
  }

  const sortedThemes = Array.from(byTheme.keys()).sort((a, b) => collator.compare(a, b));

  lines.push('', '## Beobachtungen');
  for (const theme of sortedThemes) {
    const themeObs = byTheme.get(theme) ?? [];
    for (const obs of themeObs) {
      lines.push('', `### ${theme}`);
      if (obs.status.trim().length > 0) lines.push(`- Status: ${obs.status}`);
      if (obs.fact.trim().length > 0) {
        lines.push(`- Beobachtung: ${summarizeField(obs.fact)}`);
      }
      if (obs.pattern.trim().length > 0) {
        lines.push(`- Muster: ${summarizeField(obs.pattern)}`);
      }
      if (obs.selfRegulation.trim().length > 0) {
        lines.push(`- Selbstregulation: ${summarizeField(obs.selfRegulation)}`);
      }
    }
  }
}

function hasObservationContent(obs: Observation): boolean {
  return (
    obs.status.trim().length > 0 ||
    obs.fact.trim().length > 0 ||
    obs.pattern.trim().length > 0 ||
    obs.selfRegulation.trim().length > 0
  );
}

function appendLabValues(
  lines: string[],
  report: LabReport | null,
  abnormalValues: LabValue[],
): void {
  if (!report || abnormalValues.length === 0) return;

  const dateHeader = report.labName
    ? `Letzter Befund: ${report.reportDate} (${report.labName})`
    : `Letzter Befund: ${report.reportDate}`;

  lines.push('', '## Laborwerte', dateHeader);
  for (const v of abnormalValues) {
    const unit = v.unit ? ` ${v.unit}` : '';
    const range = v.referenceRange ? ` (Referenz: ${v.referenceRange})` : '';
    const assessment = v.assessment ? ` - ${v.assessment}` : '';
    lines.push(`- ${v.parameter}: ${v.result}${unit}${range}${assessment}`);
  }
}

function appendSupplements(lines: string[], supplements: Supplement[]): void {
  if (supplements.length === 0) return;
  lines.push('', '## Supplemente');
  for (const s of supplements) {
    lines.push(`- ${s.name} (${CATEGORY_LABEL[s.category]})`);
  }
}

function appendOpenPoints(lines: string[], openPoints: OpenPoint[]): void {
  if (openPoints.length === 0) return;
  lines.push('', '## Offene Punkte (ungeloest)');
  for (const p of openPoints) {
    const prefix = p.priority?.trim() ? `[${p.priority.trim()}] ` : '';
    lines.push(`- ${prefix}${p.text}`);
  }
}

function appendWarningSigns(lines: string[], warningSigns: string[]): void {
  if (warningSigns.length === 0) return;
  lines.push('', '## Warnsignale');
  for (const w of warningSigns) {
    lines.push(`- ${w}`);
  }
}

/**
 * Decide whether a lab value is "abnormal". The assessment field is free
 * text, so we negate a small set of German normal phrases rather than
 * enumerating every possible abnormal variant. Missing/empty assessments
 * are treated as "no signal to report" and excluded.
 */
function isAbnormal(value: LabValue): boolean {
  const raw = value.assessment?.trim();
  if (!raw) return false;
  return !NORMAL_ASSESSMENTS.has(raw.toLowerCase());
}

/**
 * Collapse all internal whitespace to single spaces, then truncate at a
 * word boundary. Keeps the summary one line per field regardless of the
 * original Markdown bullets or line breaks.
 */
export function summarizeField(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return truncateAtWordBoundary(collapsed, FIELD_TRUNCATION_CHARS);
}

export function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  // Fall back to a hard cut only when no reasonable word boundary exists
  // (e.g., a single very long word or URL-like content).
  if (lastSpace === -1 || lastSpace < maxChars * 0.5) {
    return `${cut.trim()}...`;
  }
  return `${cut.slice(0, lastSpace).trimEnd()}...`;
}

/**
 * Render a compact weight trend from the first and last entries of
 * weightHistory. Returns null when fewer than two entries exist, so the
 * caller can omit the line entirely.
 */
export function formatWeightTrend(history: WeightEntry[]): string | null {
  if (history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last) return null;
  return `${first.weightKg} kg (${formatMonthYear(first.date)}) -> ${last.weightKg} kg (${formatMonthYear(last.date)})`;
}

function formatMonthYear(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  if (!match) return isoDate;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const month = GERMAN_MONTHS[monthIdx];
  if (!month || !year) return isoDate;
  return `${month} ${year}`;
}
