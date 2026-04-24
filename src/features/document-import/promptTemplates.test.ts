import { describe, it, expect } from 'vitest';
import {
  PROMPT_TEMPLATES,
  composeExtractorPrompt,
  type ExtractorName,
  type PromptTemplate,
} from './promptTemplates';
import { STRUCTURE_ONLY } from './prompts';
import type { DocumentType } from './types';

const DOCUMENT_TYPES: DocumentType[] = [
  'lab-report',
  'doctor-letter',
  'prescription',
  'imaging-report',
  'insurer-app-export',
  'generic-medical-document',
];

const EXTRACTOR_NAMES: ExtractorName[] = [
  'extract_observations',
  'extract_lab_values',
  'extract_supplements',
  'extract_open_points',
];

const ENTITY_KIND_BY_EXTRACTOR: Record<ExtractorName, string> = {
  extract_observations: 'Beobachtungen',
  extract_lab_values: 'Laborwerte',
  extract_supplements: 'Supplemente',
  extract_open_points: 'offene Punkte',
};

/** Upper bound on composed prompt length (sanity, not a hard cap). */
const MAX_PROMPT_CHARS = 5000;

describe('PROMPT_TEMPLATES registry', () => {
  it('has an entry for every DocumentType', () => {
    for (const type of DOCUMENT_TYPES) {
      const template = PROMPT_TEMPLATES[type];
      expect(template).toBeDefined();
      expect(template.systemPromptFragment.length).toBeGreaterThan(0);
    }
  });

  it('every systemPromptFragment is non-trivial (≥ 20 chars)', () => {
    for (const type of DOCUMENT_TYPES) {
      expect(PROMPT_TEMPLATES[type].systemPromptFragment.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('no two DocumentTypes share an identical systemPromptFragment', () => {
    const fragments = DOCUMENT_TYPES.map((t) => PROMPT_TEMPLATES[t].systemPromptFragment);
    const unique = new Set(fragments);
    expect(unique.size).toBe(DOCUMENT_TYPES.length);
  });
});

describe('composeExtractorPrompt', () => {
  it('includes STRUCTURE_ONLY base verbatim for every (type, extractor) combination', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const name of EXTRACTOR_NAMES) {
        const composed = composeExtractorPrompt({
          documentType: type,
          entityKind: ENTITY_KIND_BY_EXTRACTOR[name],
          extractorName: name,
          structureOnlyBase: STRUCTURE_ONLY,
        });
        expect(composed).toContain(STRUCTURE_ONLY);
      }
    }
  });

  it('includes the per-type systemPromptFragment for every extractor', () => {
    for (const type of DOCUMENT_TYPES) {
      const fragment = PROMPT_TEMPLATES[type].systemPromptFragment;
      for (const name of EXTRACTOR_NAMES) {
        const composed = composeExtractorPrompt({
          documentType: type,
          entityKind: ENTITY_KIND_BY_EXTRACTOR[name],
          extractorName: name,
          structureOnlyBase: STRUCTURE_ONLY,
        });
        expect(composed).toContain(fragment);
      }
    }
  });

  it('includes the classification-type sentence + entity-kind instruction', () => {
    const composed = composeExtractorPrompt({
      documentType: 'lab-report',
      entityKind: 'Laborwerte',
      extractorName: 'extract_lab_values',
      structureOnlyBase: STRUCTURE_ONLY,
    });
    expect(composed).toContain('klassifiziert als: lab-report');
    expect(composed).toContain('Extrahiere alle Laborwerte');
  });

  it('appends the extractor hint when the template has one for that extractor', () => {
    const template = PROMPT_TEMPLATES['lab-report'];
    const hint = template.extractorHints?.extract_lab_values;
    expect(hint).toBeDefined();
    if (!hint) throw new Error('expected lab-report extract_lab_values hint to be defined');

    const composed = composeExtractorPrompt({
      documentType: 'lab-report',
      entityKind: 'Laborwerte',
      extractorName: 'extract_lab_values',
      structureOnlyBase: STRUCTURE_ONLY,
    });
    expect(composed).toContain(hint);
  });

  it('does NOT append the hint to other extractors', () => {
    const hint = PROMPT_TEMPLATES['lab-report'].extractorHints?.extract_lab_values;
    if (!hint) throw new Error('expected lab-report extract_lab_values hint');

    for (const name of EXTRACTOR_NAMES) {
      if (name === 'extract_lab_values') continue;
      const composed = composeExtractorPrompt({
        documentType: 'lab-report',
        entityKind: ENTITY_KIND_BY_EXTRACTOR[name],
        extractorName: name,
        structureOnlyBase: STRUCTURE_ONLY,
      });
      expect(composed).not.toContain(hint);
    }
  });

  it('omits the hint section entirely when the template has no hint for that extractor', () => {
    // insurer-app-export has no extractorHints at all.
    const composed = composeExtractorPrompt({
      documentType: 'insurer-app-export',
      entityKind: 'Laborwerte',
      extractorName: 'extract_lab_values',
      structureOnlyBase: STRUCTURE_ONLY,
    });
    // Base + type sentence + fragment + entity instruction = 4 sections.
    const sectionCount = composed.split('\n\n').length;
    expect(sectionCount).toBe(4);
  });

  it('produces distinct composed prompts for different document types with the same entity-kind', () => {
    const labForLabReport = composeExtractorPrompt({
      documentType: 'lab-report',
      entityKind: 'Laborwerte',
      extractorName: 'extract_lab_values',
      structureOnlyBase: STRUCTURE_ONLY,
    });
    const labForImaging = composeExtractorPrompt({
      documentType: 'imaging-report',
      entityKind: 'Laborwerte',
      extractorName: 'extract_lab_values',
      structureOnlyBase: STRUCTURE_ONLY,
    });
    expect(labForLabReport).not.toBe(labForImaging);
  });

  it('stays under the sanity length threshold for every combination', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const name of EXTRACTOR_NAMES) {
        const composed = composeExtractorPrompt({
          documentType: type,
          entityKind: ENTITY_KIND_BY_EXTRACTOR[name],
          extractorName: name,
          structureOnlyBase: STRUCTURE_ONLY,
        });
        expect(
          composed.length,
          `(${type}, ${name}) composed prompt exceeds ${MAX_PROMPT_CHARS} chars`,
        ).toBeLessThan(MAX_PROMPT_CHARS);
      }
    }
  });
});

describe('high-value negative hints (Q3)', () => {
  it('imaging-report → extract_lab_values hints that labs are absent', () => {
    const hint = PROMPT_TEMPLATES['imaging-report'].extractorHints?.extract_lab_values;
    expect(hint).toBeDefined();
    expect(hint).toMatch(/keine Laborwerte|leeres Array/i);
  });

  it('prescription → extract_open_points hints that open points are typically absent', () => {
    const hint = PROMPT_TEMPLATES['prescription'].extractorHints?.extract_open_points;
    expect(hint).toBeDefined();
    expect(hint).toMatch(/keine offenen Punkte|leeres Array/i);
  });
});

describe('prescription → supplements bridge (Q2)', () => {
  it('prescription template hints that Rezept-listed supplements can be extracted', () => {
    const hint = PROMPT_TEMPLATES['prescription'].extractorHints?.extract_supplements;
    expect(hint).toBeDefined();
    expect(hint).toMatch(/Vitamin D|Magnesium|Supplement/i);
    expect(hint).toMatch(/Dauermedikation|rezeptpflichtig/i);
  });
});

describe('PromptTemplate type guardrails', () => {
  it('extractorHints is optional on every template', () => {
    const templates: PromptTemplate[] = DOCUMENT_TYPES.map((t) => PROMPT_TEMPLATES[t]);
    // All templates type-check whether or not extractorHints is present.
    for (const template of templates) {
      if (template.extractorHints) {
        for (const key of Object.keys(template.extractorHints)) {
          expect(EXTRACTOR_NAMES).toContain(key as ExtractorName);
        }
      }
    }
  });
});
