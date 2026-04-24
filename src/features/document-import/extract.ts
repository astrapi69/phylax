import { readAIConfig } from '../../db/aiConfig';
import { requestCompletion } from '../ai-chat/api';
import type { AnthropicMessage, ChatError, ToolDefinition, ToolUseBlock } from '../ai-chat/api';
import { AiCallError, mapChatErrorToAiCallError, withRetry } from './aiCallError';
import { buildContentBlocks } from './classify';
import {
  EXTRACT_OBSERVATIONS_TOOL,
  EXTRACT_LAB_VALUES_TOOL,
  EXTRACT_SUPPLEMENTS_TOOL,
  EXTRACT_OPEN_POINTS_TOOL,
  extractorSystemPrompt,
} from './prompts';
import type { DocumentClassification, PreparedInput } from './types';
import type {
  ExtractedDrafts,
  LabReportMeta,
  LabValueDraft,
  ObservationDraft,
  OpenPointDraft,
  SupplementDraft,
} from './drafts';
import { EMPTY_DRAFTS } from './drafts';
import type { SupplementCategory } from '../../domain/supplement/types';

/**
 * Higher-quality model for extraction. Per-class extraction needs
 * structured-output reliability that justifies the cost vs Haiku.
 * Override-able per-call via `ExtractOptions.model`.
 */
export const EXTRACTION_MODEL = 'claude-sonnet-4-6';

export interface ExtractOptions {
  signal?: AbortSignal;
  model?: string;
  /** Test escape hatch for `withRetry` delays. */
  retryDelay?: (ms: number) => Promise<void>;
}

/**
 * Run all four per-class extractors concurrently for a classified
 * `PreparedInput`. Returns an `ExtractedDrafts` aggregate.
 *
 * Concurrency rationale: each per-class call is independent;
 * running them in parallel cuts wall-clock by 4x at the cost of 4
 * concurrent in-flight requests. Anthropic's per-key concurrency
 * limit is well above 4. AbortSignal cancels all four.
 *
 * Reads AI config via `readAIConfig`; throws
 * `AiCallError('ai-config-missing')` if not configured.
 */
export async function extractEntries(
  input: PreparedInput,
  classification: DocumentClassification,
  options: ExtractOptions = {},
): Promise<ExtractedDrafts> {
  const config = await readAIConfig();
  if (!config) {
    throw new AiCallError('ai-config-missing');
  }
  const model = options.model ?? EXTRACTION_MODEL;
  const sharedOpts = { ...options, model };

  const [observations, labResult, supplements, openPoints] = await Promise.all([
    extractObservations(input, classification, config.apiKey, sharedOpts),
    extractLabValues(input, classification, config.apiKey, sharedOpts),
    extractSupplements(input, classification, config.apiKey, sharedOpts),
    extractOpenPoints(input, classification, config.apiKey, sharedOpts),
  ]);
  return {
    observations,
    labValues: labResult.drafts,
    supplements,
    openPoints,
    labReportMeta: labResult.meta,
  };
}

/**
 * Result of `extractLabValues`: per-value drafts plus document-level
 * report metadata used by the IMP-04 commit pipeline to synthesize
 * the parent `LabReport`.
 */
export interface LabValuesExtractionResult {
  drafts: LabValueDraft[];
  meta: LabReportMeta;
}

// ─── Per-class extractors ────────────────────────────────────────────

export async function extractObservations(
  input: PreparedInput,
  classification: DocumentClassification,
  apiKey: string,
  options: ExtractOptions & { model: string },
): Promise<ObservationDraft[]> {
  const toolUse = await callExtractorWithTool({
    input,
    classification,
    apiKey,
    options,
    tool: EXTRACT_OBSERVATIONS_TOOL,
    entityKindGerman: 'Beobachtungen (Fakt/Muster/Selbstregulation)',
  });
  const items = (toolUse.input as { observations?: unknown }).observations;
  if (!Array.isArray(items)) return [];
  return items.map(toObservationDraft);
}

export async function extractLabValues(
  input: PreparedInput,
  classification: DocumentClassification,
  apiKey: string,
  options: ExtractOptions & { model: string },
): Promise<LabValuesExtractionResult> {
  const toolUse = await callExtractorWithTool({
    input,
    classification,
    apiKey,
    options,
    tool: EXTRACT_LAB_VALUES_TOOL,
    entityKindGerman: 'Laborwerte',
  });
  const raw = toolUse.input as {
    labValues?: unknown;
    reportDate?: unknown;
    labName?: unknown;
  };
  const items = Array.isArray(raw.labValues) ? raw.labValues : [];
  return {
    drafts: items.map(toLabValueDraft),
    meta: toLabReportMeta(raw.reportDate, raw.labName),
  };
}

/**
 * Convert raw tool_use fields to a `LabReportMeta`. Only retains a
 * `reportDate` that round-trips ISO YYYY-MM-DD parsing so the commit
 * pipeline can trust the value without re-validating.
 */
function toLabReportMeta(rawDate: unknown, rawName: unknown): LabReportMeta {
  const meta: LabReportMeta = {};
  if (typeof rawDate === 'string' && isIsoDate(rawDate)) {
    meta.reportDate = rawDate;
  }
  if (typeof rawName === 'string' && rawName.trim().length > 0) {
    meta.labName = rawName.trim();
  }
  return meta;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

export async function extractSupplements(
  input: PreparedInput,
  classification: DocumentClassification,
  apiKey: string,
  options: ExtractOptions & { model: string },
): Promise<SupplementDraft[]> {
  const toolUse = await callExtractorWithTool({
    input,
    classification,
    apiKey,
    options,
    tool: EXTRACT_SUPPLEMENTS_TOOL,
    entityKindGerman: 'Ergänzungen / Supplemente',
  });
  const items = (toolUse.input as { supplements?: unknown }).supplements;
  if (!Array.isArray(items)) return [];
  return items.map(toSupplementDraft);
}

export async function extractOpenPoints(
  input: PreparedInput,
  classification: DocumentClassification,
  apiKey: string,
  options: ExtractOptions & { model: string },
): Promise<OpenPointDraft[]> {
  const toolUse = await callExtractorWithTool({
    input,
    classification,
    apiKey,
    options,
    tool: EXTRACT_OPEN_POINTS_TOOL,
    entityKindGerman: 'offene Punkte / Aktionsitems',
  });
  const items = (toolUse.input as { openPoints?: unknown }).openPoints;
  if (!Array.isArray(items)) return [];
  return items.map(toOpenPointDraft);
}

// ─── Shared call helper ─────────────────────────────────────────────

interface CallExtractorOptions {
  input: PreparedInput;
  classification: DocumentClassification;
  apiKey: string;
  options: ExtractOptions & { model: string };
  tool: ToolDefinition;
  entityKindGerman: string;
}

async function callExtractorWithTool(args: CallExtractorOptions): Promise<ToolUseBlock> {
  const messages: AnthropicMessage[] = [{ role: 'user', content: buildContentBlocks(args.input) }];
  const result = await withRetry(
    async () => {
      try {
        return await requestCompletion({
          apiKey: args.apiKey,
          model: args.options.model,
          system: extractorSystemPrompt(args.classification.type, args.entityKindGerman),
          messages,
          tools: [args.tool],
          toolChoice: { type: 'tool', name: args.tool.name },
          signal: args.options.signal,
        });
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (isChatError(err)) throw mapChatErrorToAiCallError(err as ChatError);
        throw new AiCallError(
          'malformed-response',
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    { signal: args.options.signal, delay: args.options.retryDelay },
  );

  if (result.stopReason === 'max_tokens') {
    throw new AiCallError('response-truncated');
  }

  const match = result.toolUses.find((t) => t.name === args.tool.name);
  if (!match) {
    throw new AiCallError(
      'malformed-response',
      `Expected tool_use "${args.tool.name}" not found in model response`,
    );
  }
  return match;
}

// ─── Mappers from tool_use input → draft types ───────────────────────

function toObservationDraft(raw: unknown): ObservationDraft {
  const o = raw as Record<string, unknown>;
  return {
    theme: stringOr(o.theme, ''),
    fact: stringOr(o.fact, ''),
    pattern: stringOr(o.pattern, ''),
    selfRegulation: stringOr(o.selfRegulation, ''),
    status: stringOr(o.status, ''),
    medicalFinding: optionalString(o.medicalFinding),
    relevanceNotes: optionalString(o.relevanceNotes),
    source: 'ai',
    extraSections: {},
  };
}

function toLabValueDraft(raw: unknown): LabValueDraft {
  const v = raw as Record<string, unknown>;
  return {
    category: stringOr(v.category, ''),
    parameter: stringOr(v.parameter, ''),
    result: stringOr(v.result, ''),
    unit: optionalString(v.unit),
    referenceRange: optionalString(v.referenceRange),
    assessment: optionalString(v.assessment),
  };
}

function toSupplementDraft(raw: unknown): SupplementDraft {
  const s = raw as Record<string, unknown>;
  return {
    name: stringOr(s.name, ''),
    brand: optionalString(s.brand),
    category: normalizeSupplementCategory(s.category),
    recommendation: optionalString(s.recommendation),
    rationale: optionalString(s.rationale),
  };
}

function toOpenPointDraft(raw: unknown): OpenPointDraft {
  const p = raw as Record<string, unknown>;
  return {
    text: stringOr(p.text, ''),
    context: stringOr(p.context, ''),
    priority: optionalString(p.priority),
    timeHorizon: optionalString(p.timeHorizon),
    details: optionalString(p.details),
    resolved: false,
  };
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function optionalString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function normalizeSupplementCategory(v: unknown): SupplementCategory {
  if (v === 'daily' || v === 'regular' || v === 'paused' || v === 'on-demand') return v;
  return 'on-demand';
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function isChatError(
  err: unknown,
): err is { kind: 'auth' | 'rate-limit' | 'server' | 'network' | 'unknown'; message?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'kind' in err &&
    typeof (err as { kind: unknown }).kind === 'string' &&
    ['auth', 'rate-limit', 'server', 'network', 'unknown'].includes((err as { kind: string }).kind)
  );
}

/** Re-export for callers that want the empty default. */
export { EMPTY_DRAFTS };
