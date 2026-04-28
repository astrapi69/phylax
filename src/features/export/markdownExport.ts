import type {
  Profile,
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  TimelineEntry,
  SupplementCategory,
  Document,
} from '../../domain';
import { getDisplayName } from '../../domain';
import {
  classifyMime,
  formatBytes,
  pickLinkedDocuments,
  resolveLinkTargets,
  type LinkTarget,
} from './appendix';
import type { ExportOptions } from './exportOptions';

/**
 * Export the full profile plus its entities as a single Markdown document
 * in the "Lebende Gesundheit" format, round-trip compatible with
 * parseProfile (IM-01). Round-trip is guaranteed at the structural level:
 * observation themes, supplement names, open-point contexts, lab-report
 * dates, and timeline periods survive a re-import. IDs regenerate and
 * timestamps (createdAt / updatedAt) are authoritative from the import,
 * so those are intentionally excluded from the export body.
 *
 * German content (section headings, field labels) is hardcoded because
 * the parser matches German keywords. Export content does not depend on
 * UI language.
 *
 * Empty sections are omitted entirely (no empty headings).
 */
export function exportProfileAsMarkdown(
  profile: Profile,
  observations: readonly Observation[],
  labReports: readonly LabReport[],
  labValues: readonly LabValue[],
  supplements: readonly Supplement[],
  openPoints: readonly OpenPoint[],
  timelineEntries: readonly TimelineEntry[],
  options: ExportOptions = {},
  documents: readonly Document[] = [],
): string {
  const { baseData, warningSigns, externalReferences, version, lastUpdateReason } = profile;

  const filteredObservations = filterByDateRange(
    filterByThemes(observations, options.themes),
    options.dateRange,
    (o) => new Date(o.updatedAt),
  );
  const filteredReports = filterByDateRange(
    labReports,
    options.dateRange,
    (r) => new Date(r.reportDate),
  );
  const filteredReportIds = new Set(filteredReports.map((r) => r.id));
  const filteredValues = labValues.filter((v) => filteredReportIds.has(v.reportId));
  const filteredTimeline = filterByDateRange(
    timelineEntries,
    options.dateRange,
    (t) => new Date(t.updatedAt),
  );

  // Section order + numbering follow the canonical Lebende-Gesundheit
  // fixture: 1 Basisdaten, 2 Vorgeschichte, 3 Blutwerte, 5 Verträglichkeiten,
  // 7 Warnsignale, 9 Externe Referenzen, 10 Verlaufsnotizen, 11 Offene Punkte.
  // Sections 4 (Belastungsreaktionen), 6 (Gewichtsmanagement), 8
  // (Selbstregulationsverhalten) exist in the fixture but are out of
  // the export's domain model, so their numbers are skipped. The numbers
  // are decorative; the parser matches by heading text regardless.
  const sections: string[] = [];
  sections.push(buildHeader(profile));
  const base = buildBasisdaten(baseData);
  if (base) sections.push(base);
  const obsBlock = buildBeobachtungen(filteredObservations);
  if (obsBlock) sections.push(obsBlock);
  const labBlock = buildBlutwerte(filteredReports, filteredValues);
  if (labBlock) sections.push(labBlock);
  const suppBlock = buildSupplemente(supplements);
  if (suppBlock) sections.push(suppBlock);
  const warnBlock = buildWarnsignale(warningSigns);
  if (warnBlock) sections.push(warnBlock);
  const refsBlock = buildExterneReferenzen(externalReferences);
  if (refsBlock) sections.push(refsBlock);
  const timelineBlock = buildVerlaufsnotizen(filteredTimeline);
  if (timelineBlock) sections.push(timelineBlock);
  const openBlock = buildOffenePunkte(openPoints);
  if (openBlock) sections.push(openBlock);
  // X-05 appendix: independent of dateRange + themes filters by design.
  // Empty selection (no linked documents OR option not set) skips
  // entirely so opt-in is never visually punishing.
  if (options.includeLinkedDocuments) {
    const appendix = buildVerlinkteDokumenteAppendix(
      documents,
      observations,
      labValues,
      labReports,
    );
    if (appendix) sections.push(appendix);
  }
  sections.push(buildFooter(version, lastUpdateReason));

  return sections.join('\n\n') + '\n';

  function buildHeader(p: Profile): string {
    const name = getDisplayName(p);
    const typeLabel =
      p.baseData.profileType === 'proxy'
        ? `Stellvertreter${p.baseData.managedBy ? `: betreut von ${p.baseData.managedBy}` : ''}`
        : 'Selbst';
    const exportedAt = formatDateIso(new Date());
    const lines = [
      `# ${name} (${typeLabel})`,
      '',
      `**Version:** ${p.version}`,
      `**Letzte Aktualisierung:** ${exportedAt}`,
    ];
    if (lastUpdateReason) {
      lines.push(`**Änderungsgrund:** ${lastUpdateReason}`);
    }
    return lines.join('\n');
  }
}

function buildBasisdaten(base: Profile['baseData']): string | null {
  const lines: string[] = [];
  if (base.birthDate) lines.push(`- **Geburtsdatum:** ${base.birthDate}`);
  if (typeof base.age === 'number') lines.push(`- **Alter:** ${base.age}`);
  if (typeof base.heightCm === 'number') lines.push(`- **Größe:** ${base.heightCm} cm`);
  if (typeof base.weightKg === 'number') lines.push(`- **Gewicht:** ${base.weightKg} kg`);
  if (typeof base.targetWeightKg === 'number') {
    lines.push(`- **Zielgewicht:** ${base.targetWeightKg} kg`);
  }
  if (base.knownDiagnoses.length > 0) {
    lines.push(`- **Bekannte Diagnosen:** ${base.knownDiagnoses.join(', ')}`);
  }
  if (base.currentMedications.length > 0) {
    lines.push(`- **Aktuelle Medikation:** ${base.currentMedications.join(', ')}`);
  }
  if (base.relevantLimitations.length > 0) {
    lines.push(`- **Relevante Einschränkungen:** ${base.relevantLimitations.join(', ')}`);
  }
  if (base.primaryDoctor?.name) {
    const d = base.primaryDoctor;
    const parts = [d.name, d.address].filter(Boolean);
    lines.push(`- **Hausarzt:** ${parts.join(', ')}`);
  }
  if (lines.length === 0 && !base.contextNotes) return null;
  const body = ['## 1. Basisdaten', '', ...lines];
  if (base.contextNotes && base.contextNotes.trim().length > 0) {
    body.push('', base.contextNotes.trim());
  }
  return body.join('\n');
}

function buildBeobachtungen(observations: readonly Observation[]): string | null {
  if (observations.length === 0) return null;
  const byTheme = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = byTheme.get(o.theme) ?? [];
    list.push(o);
    byTheme.set(o.theme, list);
  }
  const themes = Array.from(byTheme.keys()).sort((a, b) => a.localeCompare(b, 'de'));
  const lines: string[] = ['## 2. Relevante Vorgeschichte'];
  for (const theme of themes) {
    const entries = byTheme.get(theme) ?? [];
    for (const obs of entries) {
      lines.push('', `### ${theme}`, '');
      if (obs.fact.trim().length > 0) lines.push(`- **Beobachtung:** ${obs.fact.trim()}`);
      if (obs.pattern.trim().length > 0) lines.push(`- **Muster:** ${obs.pattern.trim()}`);
      if (obs.selfRegulation.trim().length > 0) {
        lines.push(`- **Selbstregulation:** ${obs.selfRegulation.trim()}`);
      }
      if (obs.status.trim().length > 0) lines.push(`- **Status:** ${obs.status.trim()}`);
    }
  }
  return lines.join('\n');
}

function buildBlutwerte(reports: readonly LabReport[], values: readonly LabValue[]): string | null {
  if (reports.length === 0) return null;
  const sortedReports = [...reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const lines: string[] = ['## 3. Blutwerte'];
  for (const report of sortedReports) {
    lines.push('', `### Befund vom ${formatGermanDate(report.reportDate)}`, '');
    if (report.labName) lines.push(`- **Labor:** ${report.labName}`);
    if (report.doctorName) lines.push(`- **Arzt:** ${report.doctorName}`);
    if (report.reportNumber) lines.push(`- **Bericht-Nr.:** ${report.reportNumber}`);
    if (report.contextNote) lines.push('', report.contextNote.trim());

    const reportValues = values.filter((v) => v.reportId === report.id);
    if (reportValues.length === 0) continue;
    const byCategory = new Map<string, LabValue[]>();
    for (const v of reportValues) {
      const list = byCategory.get(v.category) ?? [];
      list.push(v);
      byCategory.set(v.category, list);
    }
    for (const [category, catValues] of byCategory) {
      lines.push('', `### ${category}`, '');
      lines.push('| Parameter | Ergebnis | Einheit | Referenz | Bewertung |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const v of catValues) {
        const cells = [
          escapeCell(v.parameter),
          escapeCell(v.result),
          escapeCell(v.unit ?? ''),
          escapeCell(v.referenceRange ?? ''),
          escapeCell(v.assessment ?? ''),
        ];
        lines.push(`| ${cells.join(' | ')} |`);
      }
    }
  }
  return lines.join('\n');
}

const SUPPLEMENT_CATEGORY_LABEL: Record<SupplementCategory, string> = {
  daily: 'täglich',
  regular: 'regelmäßig',
  'on-demand': 'bei Bedarf',
  paused: 'pausiert',
};

function buildSupplemente(supplements: readonly Supplement[]): string | null {
  if (supplements.length === 0) return null;
  const lines: string[] = ['## 5. Verträglichkeiten', '', '### Supplemente / Medikamente', ''];
  lines.push('| Kategorie | Präparat |');
  lines.push('| --- | --- |');
  const sorted = [...supplements].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  for (const s of sorted) {
    const label = SUPPLEMENT_CATEGORY_LABEL[s.category];
    lines.push(`| ${escapeCell(label)} | ${escapeCell(s.name)} |`);
  }
  return lines.join('\n');
}

function buildWarnsignale(warningSigns: readonly string[]): string | null {
  if (warningSigns.length === 0) return null;
  const lines: string[] = ['## 7. Warnsignale', ''];
  for (const sign of warningSigns) {
    lines.push(`- ${sign}`);
  }
  return lines.join('\n');
}

function buildExterneReferenzen(refs: readonly string[]): string | null {
  if (refs.length === 0) return null;
  const lines: string[] = ['## 9. Externe Referenzen', ''];
  for (const ref of refs) {
    lines.push(`- ${ref}`);
  }
  return lines.join('\n');
}

function buildVerlaufsnotizen(entries: readonly TimelineEntry[]): string | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
  const lines: string[] = ['## 10. Verlaufsnotizen'];
  for (const entry of sorted) {
    lines.push('', `### ${entry.period} - ${entry.title}`, '', entry.content.trim());
  }
  return lines.join('\n');
}

function buildOffenePunkte(points: readonly OpenPoint[]): string | null {
  const unresolved = points.filter((p) => !p.resolved);
  if (unresolved.length === 0) return null;
  const byContext = new Map<string, OpenPoint[]>();
  for (const p of unresolved) {
    const list = byContext.get(p.context) ?? [];
    list.push(p);
    byContext.set(p.context, list);
  }
  const lines: string[] = ['## 11. Offene Punkte'];
  for (const [context, items] of byContext) {
    lines.push('', `### ${context}`, '');
    for (const item of items) {
      const prefix = item.priority ? `[${item.priority}] ` : '';
      lines.push(`- ${prefix}${item.text}`);
    }
  }
  return lines.join('\n');
}

function buildVerlinkteDokumenteAppendix(
  documents: readonly Document[],
  observations: readonly Observation[],
  labValues: readonly LabValue[],
  labReports: readonly LabReport[],
): string {
  const linked = pickLinkedDocuments(documents);
  if (linked.length === 0) return '';
  const lines = ['## Anhang: Verlinkte Dokumente', ''];
  for (const doc of linked) {
    const filename = doc.filename || '(Datei ohne Name)';
    const size = formatBytes(doc.sizeBytes);
    const mimeLabel = mimeKindToGerman(doc.mimeType);
    const targetText = renderLinkTargetsGerman(doc, observations, labValues, labReports);
    lines.push(`- **${filename}** (${size}, ${mimeLabel})${targetText}`);
    if (doc.description && doc.description.trim() !== '') {
      lines.push(`  ${doc.description.trim()}`);
    }
  }
  return lines.join('\n');
}

function mimeKindToGerman(mimeType: string): string {
  switch (classifyMime(mimeType)) {
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'Bild';
    default:
      return 'Dokument';
  }
}

function renderLinkTargetsGerman(
  doc: Document,
  observations: readonly Observation[],
  labValues: readonly LabValue[],
  labReports: readonly LabReport[],
): string {
  const targets = resolveLinkTargets(doc, observations, labValues, labReports);
  if (targets.length === 0) return '';
  const parts = targets.map((t: LinkTarget) => {
    if (t.kind === 'observation') return `verlinkt mit Beobachtung „${t.theme}"`;
    if (t.kind === 'lab-value') {
      const dateSuffix = t.date ? ` vom ${t.date}` : '';
      return `verlinkt mit Laborwert ${t.parameter}${dateSuffix}`;
    }
    return 'unbekannte Verknüpfung';
  });
  return ` — ${parts.join(' · ')}`;
}

function buildFooter(version: string, lastUpdateReason: string | undefined): string {
  const exportedAt = formatDateIso(new Date());
  const lines = [
    '---',
    '',
    `**Export erstellt:** ${exportedAt}`,
    `**Phylax-Version:** 1.0.0`,
    `**Profil-Version:** ${version}`,
  ];
  if (lastUpdateReason) {
    lines.push(`**Letzter Änderungsgrund:** ${lastUpdateReason}`);
  }
  return lines.join('\n');
}

function filterByThemes(
  observations: readonly Observation[],
  themes: ExportOptions['themes'],
): readonly Observation[] {
  if (!themes || themes.length === 0) return observations;
  const whitelist = new Set(themes);
  return observations.filter((o) => whitelist.has(o.theme));
}

function filterByDateRange<T>(
  items: readonly T[],
  range: ExportOptions['dateRange'],
  extractDate: (item: T) => Date | null,
): readonly T[] {
  if (!range || (range.from === undefined && range.to === undefined)) return items;
  const fromMs = range.from?.getTime();
  const toMs = range.to?.getTime();
  return items.filter((item) => {
    const d = extractDate(item);
    if (!d || Number.isNaN(d.getTime())) return true;
    const ms = d.getTime();
    if (fromMs !== undefined && ms < fromMs) return false;
    if (toMs !== undefined && ms > toMs) return false;
    return true;
  });
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Convert an ISO date (YYYY-MM-DD) to the German DD.MM.YYYY format used
 * in lab-report headings. Falls back to the input when the format does
 * not match so non-standard values pass through unchanged.
 */
function formatGermanDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  return `${d}.${m}.${y}`;
}
