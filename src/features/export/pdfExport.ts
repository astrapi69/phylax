import type { TFunction } from 'i18next';
import type { jsPDF as JsPdfType } from 'jspdf';
import type {
  LabReport,
  LabValue,
  Observation,
  OpenPoint,
  Profile,
  Supplement,
} from '../../domain';
import { getDisplayName } from '../../domain';
import { stripMarkdown } from './markdownStripper';

/**
 * PDF export (X-02). Lazy-loaded jsPDF + jspdf-autotable so the
 * roughly 100 KB gzip cost stays out of the initial bundle (see the
 * jsPDF chunk slot in `.size-limit.json`). Returns a Blob the caller
 * passes to `triggerDownload`.
 *
 * Section order optimized for the doctor-visit use case (locked Q-decision):
 * 1. Header (title + name + generation date)
 * 2. Base data
 * 3. Lab values (table on its own page)
 * 4. Observations grouped by theme
 * 5. Supplements
 * 6. Open points
 * 7. Footer (per-page, generated last so total page count is known)
 *
 * Strings come through the caller's i18next `t` so the PDF respects
 * the user's current locale. Dates render via `Intl.DateTimeFormat`.
 *
 * Empty sections (except base data) are omitted entirely. Markdown
 * content is stripped to plain text via `stripMarkdown`; rich-text
 * rendering is registered as P-21 polish.
 */
export interface PdfExportInput {
  profile: Profile;
  observations: readonly Observation[];
  labReports: readonly LabReport[];
  labValues: readonly LabValue[];
  supplements: readonly Supplement[];
  openPoints: readonly OpenPoint[];
  t: TFunction<'export'>;
  /** BCP-47 locale tag (`'de'` / `'en'`). Drives date formatting. */
  locale: string;
  /** Override for tests; defaults to `new Date()`. */
  now?: Date;
}

const PAGE_WIDTH_MM = 210;
const MARGIN_MM = 20;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_MM;

const FONT_TITLE = 18;
const FONT_H2 = 13;
const FONT_H3 = 11;
const FONT_BODY = 10;
const FONT_FOOTER = 8;

const LINE_HEIGHT_BODY = 5;
const LINE_HEIGHT_H2 = 7;

type JsPdfDoc = JsPdfType & { lastAutoTable?: { finalY: number } };
interface AutoTableArg {
  startY: number;
  head: string[][];
  body: string[][];
  styles?: Record<string, unknown>;
  headStyles?: Record<string, unknown>;
  margin?: { left: number; right: number };
  theme?: string;
}
type AutoTablePlugin = (doc: JsPdfDoc, opts: AutoTableArg) => void;

export async function exportProfileAsPdf(input: PdfExportInput): Promise<Blob> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = (autoTableModule as { default: AutoTablePlugin }).default;
  return generate(jsPDF, autoTable, input);
}

function generate(
  JsPdfCtor: typeof JsPdfType,
  autoTable: AutoTablePlugin,
  input: PdfExportInput,
): Blob {
  const { profile, observations, labReports, labValues, supplements, openPoints, t, locale } =
    input;
  const now = input.now ?? new Date();
  const name = getDisplayName(profile);

  const doc = new JsPdfCtor({ unit: 'mm', format: 'a4' }) as JsPdfDoc;
  doc.setProperties({
    title: t('pdf.metadata.title', { name }),
    author: name,
    creator: 'Phylax',
  });

  let y = MARGIN_MM;

  // 1. Header.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_TITLE);
  doc.text(t('pdf.header.title', { name }), MARGIN_MM, y);
  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  doc.text(t('pdf.header.generated', { date: formatDate(now, locale) }), MARGIN_MM, y);
  y += LINE_HEIGHT_BODY * 2;

  // 2. Base data (always rendered, with empty placeholders for missing fields).
  y = renderBaseData(doc, y, profile, t, locale);

  // 3. Lab values (table on dedicated page if any).
  if (labReports.length > 0) {
    doc.addPage();
    y = MARGIN_MM;
    y = renderLabValues(doc, autoTable, y, labReports, labValues, t, locale);
  }

  // 4. Observations grouped by theme.
  if (observations.length > 0) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_H2 + LINE_HEIGHT_BODY * 4);
    y = renderObservations(doc, y, observations, t);
  }

  // 5. Supplements.
  if (supplements.length > 0) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_H2 + LINE_HEIGHT_BODY * 4);
    y = renderSupplements(doc, y, supplements, t);
  }

  // 6. Open points.
  if (openPoints.length > 0) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_H2 + LINE_HEIGHT_BODY * 4);
    y = renderOpenPoints(doc, y, openPoints, t);
  }

  // 7. Footer on every page (after total page count is known).
  renderFooters(doc, t, locale, now);

  return doc.output('blob');
}

function renderBaseData(
  doc: JsPdfDoc,
  yIn: number,
  profile: Profile,
  t: TFunction<'export'>,
  locale: string,
): number {
  let y = sectionHeading(doc, yIn, t('pdf.section.base-data'));
  const { baseData } = profile;
  const lines: { label: string; value: string }[] = [];
  if (baseData.birthDate) {
    lines.push({
      label: t('pdf.field.birth-date'),
      value: formatDate(parseIsoDate(baseData.birthDate), locale),
    });
  } else if (typeof baseData.age === 'number') {
    lines.push({ label: t('pdf.field.age'), value: String(baseData.age) });
  }
  lines.push({
    label: t('pdf.field.diagnoses'),
    value: baseData.knownDiagnoses.length > 0 ? baseData.knownDiagnoses.join(', ') : t('pdf.empty.none'),
  });
  lines.push({
    label: t('pdf.field.medications'),
    value:
      baseData.currentMedications.length > 0
        ? baseData.currentMedications.join(', ')
        : t('pdf.empty.none'),
  });
  lines.push({
    label: t('pdf.field.limitations'),
    value:
      baseData.relevantLimitations.length > 0
        ? baseData.relevantLimitations.join(', ')
        : t('pdf.empty.none'),
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  for (const { label, value } of lines) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_BODY);
    const wrapped = doc.splitTextToSize(`${label}: ${value}`, CONTENT_WIDTH_MM);
    doc.text(wrapped, MARGIN_MM, y);
    y += LINE_HEIGHT_BODY * wrapped.length;
  }
  return y + LINE_HEIGHT_BODY;
}

function renderLabValues(
  doc: JsPdfDoc,
  autoTable: AutoTablePlugin,
  yIn: number,
  reports: readonly LabReport[],
  values: readonly LabValue[],
  t: TFunction<'export'>,
  locale: string,
): number {
  const y = sectionHeading(doc, yIn, t('pdf.section.lab-values'));
  const reportById = new Map<string, LabReport>(reports.map((r) => [r.id, r]));
  const sorted = [...values].sort((a, b) => {
    const ra = reportById.get(a.reportId);
    const rb = reportById.get(b.reportId);
    const da = ra?.reportDate ?? '';
    const db = rb?.reportDate ?? '';
    return db.localeCompare(da);
  });
  const head = [
    [
      t('pdf.lab.col.date'),
      t('pdf.lab.col.category'),
      t('pdf.lab.col.parameter'),
      t('pdf.lab.col.result'),
      t('pdf.lab.col.unit'),
      t('pdf.lab.col.reference'),
      t('pdf.lab.col.assessment'),
    ],
  ];
  const body = sorted.map((v) => {
    const r = reportById.get(v.reportId);
    const date = r?.reportDate ? formatDate(parseIsoDate(r.reportDate), locale) : '';
    return [
      date,
      v.category,
      v.parameter,
      v.result,
      v.unit ?? '',
      v.referenceRange ?? '',
      v.assessment ?? '',
    ];
  });
  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { fontSize: FONT_FOOTER + 1, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255 },
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    theme: 'striped',
  });
  return (doc.lastAutoTable?.finalY ?? y) + LINE_HEIGHT_BODY * 2;
}

function renderObservations(
  doc: JsPdfDoc,
  yIn: number,
  observations: readonly Observation[],
  t: TFunction<'export'>,
): number {
  let y = sectionHeading(doc, yIn, t('pdf.section.observations'));
  // Group by theme; preserve sort order via Map.
  const grouped = new Map<string, Observation[]>();
  for (const obs of observations) {
    const arr = grouped.get(obs.theme);
    if (arr) arr.push(obs);
    else grouped.set(obs.theme, [obs]);
  }
  for (const [theme, list] of grouped) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_H2 + LINE_HEIGHT_BODY * 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_H3);
    doc.text(theme, MARGIN_MM, y);
    y += LINE_HEIGHT_BODY + 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY);
    for (const obs of list) {
      y = renderObservationBlock(doc, y, obs, t);
    }
  }
  return y;
}

function renderObservationBlock(
  doc: JsPdfDoc,
  yIn: number,
  obs: Observation,
  t: TFunction<'export'>,
): number {
  let y = yIn;
  const fieldOrder: { label: string; value: string }[] = [
    { label: t('pdf.field.fact'), value: stripMarkdown(obs.fact) },
    { label: t('pdf.field.pattern'), value: stripMarkdown(obs.pattern) },
    { label: t('pdf.field.self-regulation'), value: stripMarkdown(obs.selfRegulation) },
    { label: t('pdf.field.status'), value: obs.status },
  ];
  if (obs.medicalFinding && obs.medicalFinding.trim() !== '') {
    fieldOrder.push({
      label: t('pdf.field.medical-finding'),
      value: stripMarkdown(obs.medicalFinding),
    });
  }
  if (obs.relevanceNotes && obs.relevanceNotes.trim() !== '') {
    fieldOrder.push({
      label: t('pdf.field.relevance-notes'),
      value: stripMarkdown(obs.relevanceNotes),
    });
  }
  for (const { label, value } of fieldOrder) {
    if (value === '') continue;
    y = ensurePageSpace(doc, y, LINE_HEIGHT_BODY);
    const wrapped = doc.splitTextToSize(`${label}: ${value}`, CONTENT_WIDTH_MM);
    doc.text(wrapped, MARGIN_MM, y);
    y += LINE_HEIGHT_BODY * wrapped.length;
  }
  return y + 2;
}

function renderSupplements(
  doc: JsPdfDoc,
  yIn: number,
  supplements: readonly Supplement[],
  t: TFunction<'export'>,
): number {
  let y = sectionHeading(doc, yIn, t('pdf.section.supplements'));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  for (const s of supplements) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_BODY * 2);
    const headline = s.brand ? `${s.name} (${s.brand})` : s.name;
    const cat = t(`pdf.supplement.category.${s.category}`);
    const wrapped = doc.splitTextToSize(`- ${headline} - ${cat}`, CONTENT_WIDTH_MM);
    doc.text(wrapped, MARGIN_MM, y);
    y += LINE_HEIGHT_BODY * wrapped.length;
    if (s.recommendation && s.recommendation.trim() !== '') {
      const rec = doc.splitTextToSize(
        `  ${t('pdf.field.recommendation')}: ${stripMarkdown(s.recommendation)}`,
        CONTENT_WIDTH_MM,
      );
      doc.text(rec, MARGIN_MM, y);
      y += LINE_HEIGHT_BODY * rec.length;
    }
    if (s.rationale && s.rationale.trim() !== '') {
      const rat = doc.splitTextToSize(
        `  ${t('pdf.field.rationale')}: ${stripMarkdown(s.rationale)}`,
        CONTENT_WIDTH_MM,
      );
      doc.text(rat, MARGIN_MM, y);
      y += LINE_HEIGHT_BODY * rat.length;
    }
  }
  return y + LINE_HEIGHT_BODY;
}

function renderOpenPoints(
  doc: JsPdfDoc,
  yIn: number,
  points: readonly OpenPoint[],
  t: TFunction<'export'>,
): number {
  let y = sectionHeading(doc, yIn, t('pdf.section.open-points'));
  // Group by context for readability.
  const grouped = new Map<string, OpenPoint[]>();
  for (const p of points) {
    const arr = grouped.get(p.context);
    if (arr) arr.push(p);
    else grouped.set(p.context, [p]);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  for (const [context, list] of grouped) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_BODY * 2);
    doc.setFont('helvetica', 'bold');
    doc.text(context, MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    y += LINE_HEIGHT_BODY;
    for (const p of list) {
      const marker = p.resolved ? '[x]' : '[ ]';
      const wrapped = doc.splitTextToSize(`${marker} ${stripMarkdown(p.text)}`, CONTENT_WIDTH_MM);
      y = ensurePageSpace(doc, y, LINE_HEIGHT_BODY * wrapped.length);
      doc.text(wrapped, MARGIN_MM, y);
      y += LINE_HEIGHT_BODY * wrapped.length;
    }
    y += 1;
  }
  return y;
}

function renderFooters(
  doc: JsPdfDoc,
  t: TFunction<'export'>,
  locale: string,
  now: Date,
): void {
  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_FOOTER);
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const text = t('pdf.footer', {
      date: formatDate(now, locale),
      page: p,
      total: totalPages,
    });
    doc.text(text, pageWidth / 2, pageHeight - 10);
  }
}

function sectionHeading(doc: JsPdfDoc, yIn: number, text: string): number {
  let y = yIn;
  y = ensurePageSpace(doc, y, LINE_HEIGHT_H2 + LINE_HEIGHT_BODY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_H2);
  doc.text(text, MARGIN_MM, y);
  return y + LINE_HEIGHT_H2;
}

function ensurePageSpace(doc: JsPdfDoc, y: number, needed: number): number {
  const limit = doc.internal.pageSize.getHeight() - MARGIN_MM - 10;
  if (y + needed > limit) {
    doc.addPage();
    return MARGIN_MM;
  }
  return y;
}

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
