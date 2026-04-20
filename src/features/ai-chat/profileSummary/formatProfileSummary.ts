import type { TFunction } from 'i18next';
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

// These strings are compared against incoming lab-value `assessment` data
// (German free text typed by the user). They are matching patterns, not
// display output - keeping them as a code constant. Do not localize.
const NORMAL_ASSESSMENTS = new Set([
  'normal',
  'unauffaellig',
  'unauffällig',
  'ok',
  'in ordnung',
  'im normbereich',
]);

type AIChatT = TFunction<'ai-chat'>;

/**
 * Compact Markdown digest of a user's health profile, tuned for AI
 * consumption. Omits empty sections, truncates verbose observation fields
 * to FIELD_TRUNCATION_CHARS, and filters lab values to abnormal only.
 *
 * The return carries both the Markdown string (to be inserted into the
 * chat as a context message) and a counts object (used by the UI card
 * to render a collapsed summary without parsing the output).
 */
export function formatProfileShareSummary(
  t: AIChatT,
  inputs: ProfileShareInputs,
): ProfileShareResult {
  const { profile, observations, latestReport, latestReportValues } = inputs;
  const { supplements, unresolvedOpenPoints } = inputs;

  const abnormalValues = latestReportValues.filter(isAbnormal);

  const lines: string[] = [];

  lines.push(t('profile-summary.heading.profile', { name: getDisplayName(profile) }));
  if (profile.baseData.profileType === 'proxy') {
    const caregiver = profile.baseData.managedBy?.trim();
    lines.push(
      t('profile-summary.managed-by', {
        name: caregiver ? caregiver : t('profile-summary.unspecified'),
      }),
    );
  }

  appendBaseData(t, lines, profile);
  appendObservations(t, lines, observations);
  appendLabValues(t, lines, latestReport, abnormalValues);
  appendSupplements(t, lines, supplements);
  appendOpenPoints(t, lines, unresolvedOpenPoints);
  appendWarningSigns(t, lines, profile.warningSigns);

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

function appendBaseData(t: AIChatT, lines: string[], profile: Profile): void {
  const bd = profile.baseData;
  const items: string[] = [];

  if (typeof bd.age === 'number') items.push(t('profile-summary.base-data.age', { age: bd.age }));
  if (typeof bd.heightCm === 'number')
    items.push(t('profile-summary.base-data.height', { cm: bd.heightCm }));

  if (typeof bd.weightKg === 'number') {
    const target =
      typeof bd.targetWeightKg === 'number'
        ? t('profile-summary.base-data.weight-target', { kg: bd.targetWeightKg })
        : '';
    items.push(t('profile-summary.base-data.weight', { kg: bd.weightKg, target }));
  }

  const weightTrend = formatWeightTrend(t, bd.weightHistory);
  if (weightTrend) items.push(t('profile-summary.base-data.weight-trend', { trend: weightTrend }));

  if (bd.knownDiagnoses.length > 0) {
    items.push(t('profile-summary.base-data.diagnoses', { list: bd.knownDiagnoses.join(', ') }));
  }
  if (bd.currentMedications.length > 0) {
    items.push(
      t('profile-summary.base-data.medications', { list: bd.currentMedications.join(', ') }),
    );
  }
  if (bd.relevantLimitations.length > 0) {
    items.push(
      t('profile-summary.base-data.limitations', { list: bd.relevantLimitations.join(', ') }),
    );
  }
  if (bd.primaryDoctor) {
    const specialty = bd.primaryDoctor.specialty ? ` (${bd.primaryDoctor.specialty})` : '';
    items.push(t('profile-summary.base-data.doctor', { name: bd.primaryDoctor.name, specialty }));
  }

  if (items.length === 0) return;
  lines.push('', t('profile-summary.heading.base-data'), ...items);
}

function appendObservations(t: AIChatT, lines: string[], observations: Observation[]): void {
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

  lines.push('', t('profile-summary.heading.observations'));
  for (const theme of sortedThemes) {
    const themeObs = byTheme.get(theme) ?? [];
    for (const obs of themeObs) {
      lines.push('', t('profile-summary.observation.theme-heading', { theme }));
      if (obs.status.trim().length > 0)
        lines.push(t('profile-summary.observation.status', { value: obs.status }));
      if (obs.fact.trim().length > 0) {
        lines.push(t('profile-summary.observation.fact', { value: summarizeField(obs.fact) }));
      }
      if (obs.pattern.trim().length > 0) {
        lines.push(
          t('profile-summary.observation.pattern', { value: summarizeField(obs.pattern) }),
        );
      }
      if (obs.selfRegulation.trim().length > 0) {
        lines.push(
          t('profile-summary.observation.self-regulation', {
            value: summarizeField(obs.selfRegulation),
          }),
        );
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
  t: AIChatT,
  lines: string[],
  report: LabReport | null,
  abnormalValues: LabValue[],
): void {
  if (!report || abnormalValues.length === 0) return;

  const dateHeader = report.labName
    ? t('profile-summary.lab.latest-with-lab', { date: report.reportDate, lab: report.labName })
    : t('profile-summary.lab.latest', { date: report.reportDate });

  lines.push('', t('profile-summary.heading.lab-values'), dateHeader);
  for (const v of abnormalValues) {
    const unit = v.unit ? ` ${v.unit}` : '';
    const range = v.referenceRange
      ? ` ${t('profile-summary.lab.reference', { range: v.referenceRange })}`
      : '';
    const assessment = v.assessment ? ` - ${v.assessment}` : '';
    lines.push(
      t('profile-summary.lab.value-line', {
        parameter: v.parameter,
        result: v.result,
        unit,
        range,
        assessment,
      }),
    );
  }
}

function appendSupplements(t: AIChatT, lines: string[], supplements: Supplement[]): void {
  if (supplements.length === 0) return;
  lines.push('', t('profile-summary.heading.supplements'));
  for (const s of supplements) {
    const category = t(`profile-summary.supplement.category.${s.category}`);
    lines.push(t('profile-summary.supplement.line', { name: s.name, category }));
  }
}

function appendOpenPoints(t: AIChatT, lines: string[], openPoints: OpenPoint[]): void {
  if (openPoints.length === 0) return;
  lines.push('', t('profile-summary.heading.open-points'));
  for (const p of openPoints) {
    const priority = p.priority?.trim();
    if (priority) {
      lines.push(t('profile-summary.open-point.with-priority', { priority, text: p.text }));
    } else {
      lines.push(t('profile-summary.open-point.plain', { text: p.text }));
    }
  }
}

function appendWarningSigns(t: AIChatT, lines: string[], warningSigns: string[]): void {
  if (warningSigns.length === 0) return;
  lines.push('', t('profile-summary.heading.warning-signs'));
  for (const w of warningSigns) {
    lines.push(t('profile-summary.warning-sign', { value: w }));
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
export function formatWeightTrend(t: AIChatT, history: WeightEntry[]): string | null {
  if (history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last) return null;
  return t('profile-summary.base-data.weight-trend-format', {
    first: first.weightKg,
    firstDate: formatMonthYear(t, first.date),
    last: last.weightKg,
    lastDate: formatMonthYear(t, last.date),
  });
}

function formatMonthYear(t: AIChatT, isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  if (!match) return isoDate;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const months = t('profile-summary.months', { returnObjects: true }) as string[];
  const month = months[monthIdx];
  if (!month || !year) return isoDate;
  return `${month} ${year}`;
}
