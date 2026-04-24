import type { DocumentType } from './types';

/**
 * Per-`DocumentType` prompt refinements for the IMP-06 source-specific
 * extractor surface.
 *
 * Composition model (mirrors Phase 3's `systemPrompt.ts` +
 * `promptFragments.ts` architecture): the generic
 * structure-never-diagnose base (`STRUCTURE_ONLY`) is always present
 * and cannot be overridden. Templates layer additional guidance on
 * top:
 *
 * 1. `systemPromptFragment` — appended for every extractor call
 *    against this document type. Describes what's typically in this
 *    document class, what to focus on, and where to be cautious.
 *
 * 2. `extractorHints` — optional per-tool nudges keyed by
 *    `ExtractorName`. Sparse by design: most templates provide hints
 *    for at most one or two extractors (the "natural fit" ones for
 *    that document class). Negative hints (e.g., "imaging-report →
 *    extract_lab_values: return empty") are reserved for high-value
 *    cases only, not blanket "impossible combo" guards.
 *
 * All text is German — matching the rest of the Phylax AI prompt
 * surface (`STRUCTURE_ONLY`, `CLASSIFICATION_SYSTEM_PROMPT`,
 * `extractorSystemPrompt`) and the primary language of the input
 * documents (DACH healthcare).
 *
 * The registry is closed over the `DocumentType` union. Adding a new
 * document class is a type-system + single-template edit here; the
 * compose function picks it up automatically.
 */

export type ExtractorName =
  | 'extract_observations'
  | 'extract_lab_values'
  | 'extract_supplements'
  | 'extract_open_points';

export interface PromptTemplate {
  systemPromptFragment: string;
  extractorHints?: Partial<Record<ExtractorName, string>>;
}

export const PROMPT_TEMPLATES: Readonly<Record<DocumentType, PromptTemplate>> = {
  'lab-report': {
    systemPromptFragment: `Laborbefunde gruppieren Werte typischerweise unter deutschen Kategorie-Überschriften (Blutbild, Nierenwerte, Leberwerte, Schilddrüse, Lipide, Stoffwechsel, Infektionsserologie). Bewahre die Kategorie-Bezeichnungen wortgetreu. Parameternamen stehen oft mit Einheit und Referenzbereich in einer Zeile.`,
    extractorHints: {
      extract_lab_values: `Jeder Wert hat Parameter, Ergebnis und Einheit; Referenzbereich meist in Klammern oder als separate Spalte. Bei 'o.p.B.', 'negativ' oder leeren Zellen: Feld leer lassen, nicht raten. Einheiten wortgetreu übernehmen ('g/dl', 'mg/dl', 'mU/l'); nicht normalisieren.`,
    },
  },
  'doctor-letter': {
    systemPromptFragment: `Arztbriefe enthalten typischerweise Anamnese, Diagnose (oft mit ICD-10), Therapieempfehlung und Wiedervorstellungstermin. Der Befund-Abschnitt ist oft narrativ formuliert. Diagnosen und ärztliche Einschätzungen gehören in medicalFinding einer Beobachtung, nicht in fact (Fakt ist Selbstbeobachtung).`,
    extractorHints: {
      extract_open_points: `'Wiedervorstellung', 'Kontrolle in X Monaten', 'bei Beschwerden erneut vorstellen' sind typische Aktionsitems. Den Zeithorizont extrahieren, wenn genannt (z.B. 'In 3 Monaten', 'bei Bedarf').`,
    },
  },
  prescription: {
    systemPromptFragment: `Rezepte listen verschreibungspflichtige Medikamente: Wirkstoff, Stärke, Packungsgröße, Dosierungsanweisung. Meist pro Zeile ein Eintrag. Kein narrativer Kontext.`,
    extractorHints: {
      extract_supplements: `Rezepte enthalten primär verschreibungspflichtige Medikamente. Einträge wie 'Vitamin D 20.000 IE', 'Magnesium 400 mg', 'Vitamin B12' oder 'Eisen' können als Supplement-Kategorie extrahiert werden, wenn es sich um Dauermedikation handelt (höherdosierte Supplemente sind in Deutschland rezeptpflichtig und erscheinen daher auf Rezept). Bei klassischen Medikamenten (Antibiotika, Blutdrucksenker, etc.): leer lassen.`,
      extract_open_points: `Rezepte enthalten typischerweise keine offenen Punkte — die Anweisung lautet 'einnehmen', nicht 'nachverfolgen'. Leeres Array zurückgeben, es sei denn ein expliziter Hinweis steht im Rezepttext.`,
    },
  },
  'imaging-report': {
    systemPromptFragment: `Bildgebungsbefunde (Röntgen, MRT, CT, Sonographie, Mammographie) sind narrativ formuliert: Beschreibung der Aufnahme, Befundung pro Region, Beurteilung. Befunde gehören in medicalFinding einer Beobachtung. Vergleiche zu Voruntersuchungen oft erwähnt.`,
    extractorHints: {
      extract_lab_values: `Bildgebungsbefunde enthalten keine Laborwerte. Leeres Array zurückgeben.`,
    },
  },
  'insurer-app-export': {
    systemPromptFragment: `Krankenkassen-App-Exporte (TK, AOK, Barmer, DAK, etc.) variieren stark im Layout. Typische Felder: Versicherungsnummer, Diagnosen (oft mit ICD-10), Medikamentenverordnungen, Arztbesuche, Leistungsabrechnungen. Manche Exporte sind tabellarisch, andere als fortlaufender Text. Extrahiere nur Felder, die du eindeutig identifizieren kannst; bei mehrdeutigen Feldern das Feld leer lassen statt raten.`,
  },
  'generic-medical-document': {
    systemPromptFragment: `Unklar strukturiertes medizinisches Dokument. Keine Annahmen über Layout oder typische Felder. Vorsicht beim Extrahieren: im Zweifel ein Feld weglassen statt einen unsicheren Wert einzutragen.`,
  },
};

/**
 * Compose a full extractor system prompt from the always-present
 * base, the classification-informed sentence, the per-type
 * `systemPromptFragment`, the entity-kind instruction, and
 * (optionally) the per-extractor hint from `PROMPT_TEMPLATES`.
 *
 * Sections joined by blank lines. Order is stable: base → classification
 * context → per-type fragment → entity-kind instruction → hint.
 *
 * The `structureOnlyBase` parameter lets the caller inject the shared
 * `STRUCTURE_ONLY` string without this module importing back into
 * `prompts.ts` (avoids a circular dependency).
 */
export function composeExtractorPrompt(args: {
  documentType: DocumentType;
  entityKind: string;
  extractorName: ExtractorName;
  structureOnlyBase: string;
}): string {
  const template = PROMPT_TEMPLATES[args.documentType];
  const parts: string[] = [
    args.structureOnlyBase,
    `Das vorliegende Dokument ist klassifiziert als: ${args.documentType}.`,
    template.systemPromptFragment,
    `Extrahiere alle ${args.entityKind}, die im Dokument explizit erwähnt sind. Erfinde nichts. Wenn das Dokument keine ${args.entityKind} enthält, gib ein leeres Array zurück. Bei jedem Eintrag: nur Felder ausfüllen, deren Wert im Dokument explizit steht; optionale Felder leer lassen, wenn der Wert nicht im Text steht.`,
  ];
  const hint = template.extractorHints?.[args.extractorName];
  if (hint) parts.push(hint);
  return parts.join('\n\n');
}
