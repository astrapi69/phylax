import type { TFunction } from 'i18next';
import type { jsPDF as JsPdfType } from 'jspdf';
import type {
  Document,
  LabReport,
  LabValue,
  Observation,
  OpenPoint,
  Profile,
  Supplement,
} from '../../domain';
import { getDisplayName } from '../../domain';
import { classifyMime, formatBytes, pickLinkedDocuments, resolveLinkTargets } from './appendix';
import type { ExportOptions } from './exportOptions';
import { FONT_FAMILY, FontSize, Leading } from './pdf/typography';
import { CONTENT_WIDTH_MM, Gap, Margin } from './pdf/spacing';
import { composeFieldBlocks, parseRichText, renderRichText } from './pdf/richText';
import { classifyAssessment, Palette, type RGB } from './pdf/color';

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
 * content is rendered via `./pdf/richText` (X-09 Phase 2): inline
 * bold + italic, bullet items, and paragraph breaks are preserved;
 * headings, links, code, blockquotes, and HRs are stripped to plain
 * text. `stripMarkdown` is still used by other export paths and is
 * kept as a public module.
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
  /**
   * Optional date-range filter (X-03). Applied to `LabReport.reportDate`
   * and `Observation.createdAt`. Supplements and open points have no
   * comparable date and are always included. Empty / missing bounds
   * mean unbounded on that side, matching the `<DateRangeFilter>`
   * semantic from O-18.
   */
  dateRange?: ExportOptions['dateRange'];
  /**
   * Optional theme whitelist (X-04). When present and non-empty,
   * observations whose `theme` is not in the list are excluded.
   * Empty array OR `undefined` mean "no filter active" - matches the
   * `filterByThemes` contract in markdownExport for cross-format
   * consistency.
   */
  themes?: ExportOptions['themes'];
  /**
   * Documents available for the X-05 linked-documents appendix. Always
   * supplied (eager load in `useExportData`); the `includeLinkedDocuments`
   * flag controls whether the appendix renders.
   */
  documents?: readonly Document[];
  /**
   * X-05 opt-in. When true, the appendix renders at the end of the
   * document with one bullet per linked document. Independent of
   * `dateRange` and `themes` filters by design (see appendix.ts).
   */
  includeLinkedDocuments?: boolean;
  /**
   * X-09 Phase 4 opt-in. When true, the document opens with a
   * dedicated cover page (large profile name + subtitle + generation
   * date) and body content starts on page 2. Default off so the
   * doctor-visit case stays compact.
   */
  includeCoverPage?: boolean;
  /** Override for tests; defaults to `new Date()`. */
  now?: Date;
}

/**
 * Layout constants now live in `./pdf/typography.ts` and
 * `./pdf/spacing.ts`. The local aliases below are kept so existing
 * call sites read unchanged; new code should import from the token
 * modules directly.
 */
const MARGIN_MM = Margin.page;
const FONT_TITLE = FontSize.title;
const FONT_H2 = FontSize.h2;
const FONT_H3 = FontSize.h3;
const FONT_BODY = FontSize.body;
const FONT_FOOTER = FontSize.footer;
const LINE_HEIGHT_BODY = Leading.body;
const LINE_HEIGHT_H2 = Leading.h2;

type JsPdfDoc = JsPdfType & { lastAutoTable?: { finalY: number } };
interface AutoTableCellInput {
  content: string;
  styles?: { textColor?: RGB | number };
}
type AutoTableCell = string | AutoTableCellInput;
interface AutoTableArg {
  startY: number;
  head: string[][];
  body: AutoTableCell[][];
  styles?: Record<string, unknown>;
  headStyles?: Record<string, unknown>;
  bodyStyles?: Record<string, unknown>;
  alternateRowStyles?: Record<string, unknown>;
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
  const {
    profile,
    observations: rawObservations,
    labReports: rawLabReports,
    labValues,
    supplements,
    openPoints,
    t,
    locale,
    dateRange,
    themes,
    documents,
    includeLinkedDocuments,
    includeCoverPage,
  } = input;
  // X-03 date-range filter + X-04 theme filter. Supplements and open
  // points have no theme/date-comparable field; both filters skip them.
  const dateFiltered = filterObservationsByDateRange(rawObservations, dateRange);
  const observations = filterObservationsByThemes(dateFiltered, themes);
  const labReports = filterLabReportsByDateRange(rawLabReports, dateRange);
  const now = input.now ?? new Date();
  const name = getDisplayName(profile);

  const doc = new JsPdfCtor({ unit: 'mm', format: 'a4' }) as JsPdfDoc;
  doc.setProperties({
    title: t('pdf.metadata.title', { name }),
    author: name,
    creator: 'Phylax',
  });

  let y = MARGIN_MM;

  // 0. Cover page (X-09 Phase 4, opt-in).
  if (includeCoverPage) {
    renderCoverPage(doc, name, t, locale, now);
    doc.addPage();
    y = MARGIN_MM;
  }

  // 1. Header.
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(FONT_TITLE);
  doc.setTextColor(...Palette.textPrimary);
  doc.text(t('pdf.header.title', { name }), MARGIN_MM, y);
  y += Gap.afterTitle;
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(FONT_BODY);
  doc.setTextColor(...Palette.textSecondary);
  doc.text(t('pdf.header.generated', { date: formatDate(now, locale) }), MARGIN_MM, y);
  doc.setTextColor(...Palette.textPrimary);
  y += Gap.afterHeader;

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

  // 7. Section heading key reused: `pdf.section.appendix`.
  // 7. Appendix (X-05): linked documents. Independent of dateRange +
  // themes filters; rendered when the user opts in via
  // `includeLinkedDocuments` and at least one linked document exists.
  if (includeLinkedDocuments && documents && documents.length > 0) {
    const linked = pickLinkedDocuments(documents);
    if (linked.length > 0) {
      y = ensurePageSpace(doc, y, LINE_HEIGHT_H2 + LINE_HEIGHT_BODY * 4);
      // Pass the unfiltered observation/labValue arrays so link-target
      // resolution still works when the body filters excluded them.
      y = renderAppendix(doc, y, linked, rawObservations, labValues, rawLabReports, t);
    }
  }

  // 8. Headers + footers on every page (after total page count is
  //    known). Running header skips the cover page and page 1; first
  //    body page reads cleanly without repeating the profile name
  //    already in the page-1 title block.
  renderRunningHeaders(doc, name, t, includeCoverPage ?? false);
  renderFooters(doc, t, locale, now);

  return doc.output('blob');
}

function renderCoverPage(
  doc: JsPdfDoc,
  name: string,
  t: TFunction<'export'>,
  locale: string,
  now: Date,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;
  const subtitle = t('pdf.cover.subtitle');
  const generated = t('pdf.cover.generated', { date: formatDate(now, locale) });

  // Accent rule above the title block, centered.
  const titleY = pageHeight * 0.4;
  doc.setDrawColor(...Palette.accent);
  doc.setLineWidth(0.5);
  doc.line(centerX - 40, titleY - 18, centerX + 40, titleY - 18);

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(FontSize.cover);
  doc.setTextColor(...Palette.textPrimary);
  doc.text(name, centerX, titleY, { align: 'center' });

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(FontSize.coverSubtitle);
  doc.setTextColor(...Palette.accent);
  doc.text(subtitle, centerX, titleY + 10, { align: 'center' });

  doc.setFontSize(FontSize.body);
  doc.setTextColor(...Palette.textSecondary);
  doc.text(generated, centerX, titleY + 18, { align: 'center' });
  doc.setTextColor(...Palette.textPrimary);
}

function renderRunningHeaders(
  doc: JsPdfDoc,
  name: string,
  t: TFunction<'export'>,
  hasCover: boolean,
): void {
  const totalPages = doc.getNumberOfPages();
  // Running header begins one page after the first body page so the
  // first body page does not duplicate the profile name already in
  // the page-1 title block.
  const firstHeaderPage = hasCover ? 3 : 2;
  if (totalPages < firstHeaderPage) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  // Body-page numbering excludes the cover (matches the user's
  // mental model: "page 1" is the first content page, not the cover).
  const bodyPageOffset = hasCover ? 1 : 0;
  const bodyTotal = totalPages - bodyPageOffset;
  for (let p = firstHeaderPage; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(FontSize.header);
    doc.setTextColor(...Palette.textSecondary);
    const headerY = Margin.headerOffset + 4;
    const text = t('pdf.running-header', {
      name,
      page: p - bodyPageOffset,
      total: bodyTotal,
    });
    doc.text(text, pageWidth - Margin.page, headerY, { align: 'right' });
    doc.setDrawColor(...Palette.accent);
    doc.setLineWidth(0.2);
    doc.line(Margin.page, headerY + 1.5, pageWidth - Margin.page, headerY + 1.5);
    doc.setTextColor(...Palette.textPrimary);
  }
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
    value:
      baseData.knownDiagnoses.length > 0 ? baseData.knownDiagnoses.join(', ') : t('pdf.empty.none'),
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

  for (const { label, value } of lines) {
    const blocks = composeFieldBlocks(label, value);
    if (blocks.length === 0) continue;
    y = renderRichText(doc, blocks, {
      x: MARGIN_MM,
      y,
      maxWidth: CONTENT_WIDTH_MM,
      fontSize: FONT_BODY,
      leading: LINE_HEIGHT_BODY,
      blockGap: 1,
      ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
    });
  }
  return y + Gap.afterSection;
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
  const body: AutoTableCell[][] = sorted.map((v) => {
    const r = reportById.get(v.reportId);
    const date = r?.reportDate ? formatDate(parseIsoDate(r.reportDate), locale) : '';
    const assessmentRaw = v.assessment ?? '';
    const cls = classifyAssessment(assessmentRaw);
    const assessmentCell: AutoTableCell =
      cls === 'critical'
        ? { content: assessmentRaw, styles: { textColor: Palette.abnormalCritical } }
        : cls === 'notable'
          ? { content: assessmentRaw, styles: { textColor: Palette.abnormalNotable } }
          : assessmentRaw;
    return [
      date,
      v.category,
      v.parameter,
      v.result,
      v.unit ?? '',
      v.referenceRange ?? '',
      assessmentCell,
    ];
  });
  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: {
      fontSize: FontSize.small,
      cellPadding: 1.8,
      textColor: Palette.textPrimary,
    },
    headStyles: {
      fillColor: Palette.tableHeader,
      textColor: Palette.tableHeaderText,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: Palette.tableStripe },
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    theme: 'striped',
  });
  return (doc.lastAutoTable?.finalY ?? y) + Gap.afterSection;
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
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(FONT_H3);
    doc.text(theme, MARGIN_MM, y);
    y += LINE_HEIGHT_BODY + 1;
    doc.setFont(FONT_FAMILY, 'normal');
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
    { label: t('pdf.field.fact'), value: obs.fact },
    { label: t('pdf.field.pattern'), value: obs.pattern },
    { label: t('pdf.field.self-regulation'), value: obs.selfRegulation },
    { label: t('pdf.field.status'), value: obs.status },
  ];
  if (obs.medicalFinding && obs.medicalFinding.trim() !== '') {
    fieldOrder.push({
      label: t('pdf.field.medical-finding'),
      value: obs.medicalFinding,
    });
  }
  if (obs.relevanceNotes && obs.relevanceNotes.trim() !== '') {
    fieldOrder.push({
      label: t('pdf.field.relevance-notes'),
      value: obs.relevanceNotes,
    });
  }
  for (const { label, value } of fieldOrder) {
    const blocks = composeFieldBlocks(label, value);
    if (blocks.length === 0) continue;
    y = renderRichText(doc, blocks, {
      x: MARGIN_MM,
      y,
      maxWidth: CONTENT_WIDTH_MM,
      fontSize: FONT_BODY,
      leading: LINE_HEIGHT_BODY,
      blockGap: 1,
      ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
    });
  }
  return y + Gap.afterEntry;
}

function renderSupplements(
  doc: JsPdfDoc,
  yIn: number,
  supplements: readonly Supplement[],
  t: TFunction<'export'>,
): number {
  let y = sectionHeading(doc, yIn, t('pdf.section.supplements'));
  for (const s of supplements) {
    const headline = s.brand ? `${s.name} (${s.brand})` : s.name;
    const cat = t(`pdf.supplement.category.${s.category}`);
    // Headline as bold bullet so the supplement name reads first.
    y = renderRichText(
      doc,
      [
        {
          kind: 'bullet',
          runs: [
            { text: headline, style: 'bold' },
            { text: ' - ', style: 'normal' },
            { text: cat, style: 'italic' },
          ],
        },
      ],
      {
        x: MARGIN_MM,
        y,
        maxWidth: CONTENT_WIDTH_MM,
        fontSize: FONT_BODY,
        leading: LINE_HEIGHT_BODY,
        blockGap: 1,
        ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
      },
    );
    if (s.recommendation && s.recommendation.trim() !== '') {
      const blocks = composeFieldBlocks(t('pdf.field.recommendation'), s.recommendation);
      if (blocks.length > 0) {
        y = renderRichText(doc, blocks, {
          x: MARGIN_MM + 4,
          y,
          maxWidth: CONTENT_WIDTH_MM - 4,
          fontSize: FONT_BODY,
          leading: LINE_HEIGHT_BODY,
          blockGap: 1,
          ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
        });
      }
    }
    if (s.rationale && s.rationale.trim() !== '') {
      const blocks = composeFieldBlocks(t('pdf.field.rationale'), s.rationale);
      if (blocks.length > 0) {
        y = renderRichText(doc, blocks, {
          x: MARGIN_MM + 4,
          y,
          maxWidth: CONTENT_WIDTH_MM - 4,
          fontSize: FONT_BODY,
          leading: LINE_HEIGHT_BODY,
          blockGap: 1,
          ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
        });
      }
    }
    y += Gap.afterEntry;
  }
  return y + Gap.afterSection - Gap.afterEntry;
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
  for (const [context, list] of grouped) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT_BODY * 2);
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(FONT_BODY);
    doc.text(context, MARGIN_MM, y);
    y += LINE_HEIGHT_BODY;
    for (const p of list) {
      const marker = p.resolved ? '[x]' : '[ ]';
      const parsed = parseRichText(p.text);
      const [firstParsed, ...restParsed] = parsed;
      const blocks = firstParsed
        ? [
            {
              kind: 'paragraph' as const,
              runs: [{ text: `${marker} `, style: 'normal' as const }, ...firstParsed.runs],
            },
            ...restParsed,
          ]
        : [{ kind: 'paragraph' as const, runs: [{ text: marker, style: 'normal' as const }] }];
      y = renderRichText(doc, blocks, {
        x: MARGIN_MM,
        y,
        maxWidth: CONTENT_WIDTH_MM,
        fontSize: FONT_BODY,
        leading: LINE_HEIGHT_BODY,
        blockGap: 1,
        ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
      });
    }
    y += Gap.afterSubsection;
  }
  return y;
}

function renderAppendix(
  doc: JsPdfDoc,
  yIn: number,
  linked: readonly Document[],
  observations: readonly Observation[],
  labValues: readonly LabValue[],
  labReports: readonly LabReport[],
  t: TFunction<'export'>,
): number {
  let y = sectionHeading(doc, yIn, t('pdf.section.appendix'));
  for (const docMeta of linked) {
    const filename = docMeta.filename || t('appendix.unnamed');
    const size = formatBytes(docMeta.sizeBytes);
    const mimeLabel = pdfMimeLabel(docMeta.mimeType, t);
    const targetText = pdfRenderLinkTargets(docMeta, observations, labValues, labReports, t);
    const tail = `(${size}, ${mimeLabel})${targetText ? ' - ' + targetText : ''}`;
    y = renderRichText(
      doc,
      [
        {
          kind: 'bullet',
          runs: [
            { text: filename, style: 'bold' },
            { text: ` ${tail}`, style: 'normal' },
          ],
        },
      ],
      {
        x: MARGIN_MM,
        y,
        maxWidth: CONTENT_WIDTH_MM,
        fontSize: FONT_BODY,
        leading: LINE_HEIGHT_BODY,
        blockGap: 1,
        ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
      },
    );
    if (docMeta.description && docMeta.description.trim() !== '') {
      const blocks = parseRichText(docMeta.description);
      y = renderRichText(doc, blocks, {
        x: MARGIN_MM + 4,
        y,
        maxWidth: CONTENT_WIDTH_MM - 4,
        fontSize: FONT_BODY,
        leading: LINE_HEIGHT_BODY,
        blockGap: 1,
        ensureSpace: (cy, needed) => ensurePageSpace(doc, cy, needed),
      });
    }
  }
  return y + Gap.afterSection;
}

function pdfMimeLabel(mimeType: string, t: TFunction<'export'>): string {
  switch (classifyMime(mimeType)) {
    case 'pdf':
      return t('appendix.mime.pdf');
    case 'image':
      return t('appendix.mime.image');
    default:
      return t('appendix.mime.other');
  }
}

function pdfRenderLinkTargets(
  docMeta: Document,
  observations: readonly Observation[],
  labValues: readonly LabValue[],
  labReports: readonly LabReport[],
  t: TFunction<'export'>,
): string {
  const targets = resolveLinkTargets(docMeta, observations, labValues, labReports);
  return targets
    .map((tgt) => {
      if (tgt.kind === 'observation') {
        return t('appendix.link.observation', { theme: tgt.theme });
      }
      if (tgt.kind === 'lab-value') {
        return t('appendix.link.lab-value', { parameter: tgt.parameter, date: tgt.date });
      }
      return t('appendix.link.unknown');
    })
    .join(' · ');
}

function renderFooters(doc: JsPdfDoc, t: TFunction<'export'>, locale: string, now: Date): void {
  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(FONT_FOOTER);
  doc.setTextColor(...Palette.textMuted);
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const text = t('pdf.footer', { date: formatDate(now, locale) });
    doc.text(text, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  doc.setTextColor(...Palette.textPrimary);
}

function sectionHeading(doc: JsPdfDoc, yIn: number, text: string): number {
  let y = yIn;
  y = ensurePageSpace(doc, y, LINE_HEIGHT_H2 + LINE_HEIGHT_BODY);
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(FONT_H2);
  doc.setTextColor(...Palette.accent);
  doc.text(text, MARGIN_MM, y);
  // Subtle accent rule under the heading, full content width.
  const ruleY = y + 1.5;
  doc.setDrawColor(...Palette.accent);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_MM, ruleY, MARGIN_MM + CONTENT_WIDTH_MM, ruleY);
  // Restore default text color so subsequent body content is not tinted.
  doc.setTextColor(...Palette.textPrimary);
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

function filterObservationsByDateRange(
  observations: readonly Observation[],
  range: ExportOptions['dateRange'],
): readonly Observation[] {
  if (!range || (range.from === undefined && range.to === undefined)) return observations;
  const fromMs = range.from?.getTime();
  const toMs = range.to?.getTime();
  return observations.filter((o) => {
    if (fromMs !== undefined && o.createdAt < fromMs) return false;
    if (toMs !== undefined && o.createdAt > toMs) return false;
    return true;
  });
}

function filterObservationsByThemes(
  observations: readonly Observation[],
  themes: ExportOptions['themes'],
): readonly Observation[] {
  if (!themes || themes.length === 0) return observations;
  const whitelist = new Set(themes);
  return observations.filter((o) => whitelist.has(o.theme));
}

function filterLabReportsByDateRange(
  reports: readonly LabReport[],
  range: ExportOptions['dateRange'],
): readonly LabReport[] {
  if (!range || (range.from === undefined && range.to === undefined)) return reports;
  const fromMs = range.from?.getTime();
  const toMs = range.to?.getTime();
  return reports.filter((r) => {
    if (!r.reportDate) return true;
    const ms = parseIsoDate(r.reportDate).getTime();
    if (Number.isNaN(ms)) return true;
    if (fromMs !== undefined && ms < fromMs) return false;
    if (toMs !== undefined && ms > toMs) return false;
    return true;
  });
}
