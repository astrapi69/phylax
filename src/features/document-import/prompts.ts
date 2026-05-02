import type { ToolDefinition } from '../ai-chat/api';
import type { DocumentType } from './types';
import { composeExtractorPrompt, type ExtractorName } from './promptTemplates';

/**
 * System prompts and tool schemas for the IMP-03 classifier and
 * per-class extractors.
 *
 * All prompts are German because Phylax's primary market is the
 * DACH region; medical documents arrive in German. The structuring
 * principles inherit the AI-03 system prompt's contract:
 * structure-only, no diagnosis, mark uncertainties.
 *
 * IMP-06 will refine these with source-specific additions
 * (insurer-app PDFs, lab-result scans, doctor letters).
 */

export const STRUCTURE_ONLY = `Du strukturierst medizinische Dokumente. Du stellst keine
Diagnosen, gibst keine Therapieempfehlungen und übernimmst keine
klinische Verantwortung. Du extrahierst, was im Dokument steht -
nicht mehr, nicht weniger. Bei Unsicherheit lieber leer lassen als
raten.`;

// ─── Classification ──────────────────────────────────────────────────

export const CLASSIFICATION_SYSTEM_PROMPT = `${STRUCTURE_ONLY}

Klassifiziere das vorliegende Dokument in genau eine der folgenden
Kategorien:
- lab-report: Laborbericht (Bluttest, Urin, Mikrobiologie etc.)
- doctor-letter: Arztbrief (Überweisung, Befund, Entlassbrief)
- prescription: Rezept (Verschreibung von Medikamenten)
- imaging-report: Bildgebungsbefund (Röntgen, MRT, CT, Sonographie)
- insurer-app-export: Export aus Krankenkassen-App (TK, AOK, Barmer, ...)
- generic-medical-document: anderes medizinisches Dokument

Gib zusätzlich eine Konfidenz zwischen 0.0 und 1.0 an. Setze die
Konfidenz niedrig, wenn das Dokument mehrere Kategorien gleichzeitig
abdecken könnte oder wenn der Inhalt nicht eindeutig zuordenbar ist.`;

export const CLASSIFICATION_TOOL: ToolDefinition = {
  name: 'classify_document',
  description: 'Klassifiziere das Dokument in genau eine medizinische Kategorie.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: [
          'lab-report',
          'doctor-letter',
          'prescription',
          'imaging-report',
          'insurer-app-export',
          'generic-medical-document',
        ],
        description: 'Die Dokumentkategorie.',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description:
          'Konfidenz der Klassifikation. < 0.7 wird zur User-Bestätigung weitergeleitet.',
      },
    },
    required: ['type', 'confidence'],
  },
};

// ─── Per-class extractor prompts ─────────────────────────────────────

/**
 * Compose the extractor system prompt for a given document type +
 * entity kind + specific extractor tool.
 *
 * IMP-06 wires the per-`DocumentType` refinement registry in
 * `promptTemplates.ts`; the generic `STRUCTURE_ONLY` base is always
 * present (safety language cannot be dropped by a template).
 */
export function extractorSystemPrompt(
  documentType: DocumentType,
  entityKind: string,
  extractorName: ExtractorName,
): string {
  return composeExtractorPrompt({
    documentType,
    entityKind,
    extractorName,
    structureOnlyBase: STRUCTURE_ONLY,
  });
}

// ─── Extractor tool schemas ──────────────────────────────────────────

export const EXTRACT_OBSERVATIONS_TOOL: ToolDefinition = {
  name: 'extract_observations',
  description: 'Extrahiere Beobachtungen (Fakt/Muster/Selbstregulation) aus dem Dokument.',
  input_schema: {
    type: 'object',
    properties: {
      observations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            theme: { type: 'string', description: 'Thema, z.B. "Schulter", "Blutdruck"' },
            fact: { type: 'string', description: 'Was konkret im Dokument steht.' },
            pattern: { type: 'string', description: 'Beobachtetes Muster, falls erwähnt.' },
            selfRegulation: {
              type: 'string',
              description: 'Selbstregulation oder Empfehlung, falls erwähnt.',
            },
            status: {
              type: 'string',
              description: 'Status, z.B. "stabil", "akut", "in Besserung".',
            },
            medicalFinding: {
              type: 'string',
              description: 'Ärztlicher Befund, falls als solcher gekennzeichnet.',
            },
            relevanceNotes: {
              type: 'string',
              description: 'Querverweise zu anderen Themen, falls erwähnt.',
            },
          },
          required: ['theme', 'fact', 'pattern', 'selfRegulation', 'status'],
        },
      },
    },
    required: ['observations'],
  },
};

export const EXTRACT_LAB_VALUES_TOOL: ToolDefinition = {
  name: 'extract_lab_values',
  description: 'Extrahiere Laborwerte und Berichtsmetadaten aus dem Dokument.',
  input_schema: {
    type: 'object',
    properties: {
      labValues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Kategorie, z.B. "Blutbild", "Nierenwerte", "Schilddrüse".',
            },
            parameter: {
              type: 'string',
              description: 'Parameter, z.B. "Hämoglobin", "Kreatinin".',
            },
            result: { type: 'string', description: 'Messwert als String.' },
            unit: { type: 'string', description: 'Einheit, z.B. "g/dl", "mg/dl".' },
            referenceRange: { type: 'string', description: 'Referenzbereich, z.B. "13.5-17.5".' },
            assessment: {
              type: 'string',
              description: 'Bewertung, z.B. "normal", "erhöht", "erniedrigt".',
            },
          },
          required: ['category', 'parameter', 'result'],
        },
      },
      reportDate: {
        type: 'string',
        description:
          'Berichtsdatum als ISO-Datum (YYYY-MM-DD), falls eindeutig im Dokument erkennbar (z.B. "Befund vom 14.04.2026"). Leer lassen, wenn unklar oder mehrdeutig.',
      },
      labName: {
        type: 'string',
        description:
          'Name des Labors oder der ausstellenden Einrichtung, falls explizit im Dokument genannt (z.B. "Synlab MVZ", "Labor Berlin"). Leer lassen, wenn nicht eindeutig erkennbar.',
      },
    },
    required: ['labValues'],
  },
};

export const EXTRACT_SUPPLEMENTS_TOOL: ToolDefinition = {
  name: 'extract_supplements',
  description: 'Extrahiere Ergänzungen / Supplemente aus dem Dokument.',
  input_schema: {
    type: 'object',
    properties: {
      supplements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Produktname, z.B. "Vitamin D3 2000 IE".',
            },
            brand: { type: 'string', description: 'Marke, falls genannt.' },
            category: {
              type: 'string',
              enum: ['daily', 'regular', 'paused', 'on-demand'],
              description: 'Einnahmekategorie.',
            },
            recommendation: {
              type: 'string',
              description: 'Wann/wie einnehmen.',
            },
            rationale: {
              type: 'string',
              description: 'Begründung, falls im Dokument genannt.',
            },
          },
          required: ['name', 'category'],
        },
      },
    },
    required: ['supplements'],
  },
};

export const EXTRACT_OPEN_POINTS_TOOL: ToolDefinition = {
  name: 'extract_open_points',
  description: 'Extrahiere offene Punkte / Aktionsitems / Wiedervorstellungen aus dem Dokument.',
  input_schema: {
    type: 'object',
    properties: {
      openPoints: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Aktion oder Frage.' },
            context: {
              type: 'string',
              description:
                'Gruppierung, z.B. "Beim nächsten Arztbesuch", "Wiederholungs-Blutabnahme".',
            },
            priority: { type: 'string', description: 'Priorität, falls erwähnt.' },
            timeHorizon: {
              type: 'string',
              description: 'Zeithorizont, z.B. "Innerhalb 3 Monate".',
            },
            details: { type: 'string', description: 'Zusatzdetails, falls erwähnt.' },
          },
          required: ['text', 'context'],
        },
      },
    },
    required: ['openPoints'],
  },
};
