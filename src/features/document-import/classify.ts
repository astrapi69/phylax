import { readAIConfig } from '../../db/aiConfig';
import { requestCompletion } from '../ai-chat/api';
import type { AnthropicMessage, ChatError, ContentBlock, ToolUseBlock } from '../ai-chat/api';
import { AiCallError, mapChatErrorToAiCallError, withRetry } from './aiCallError';
import { CLASSIFICATION_SYSTEM_PROMPT, CLASSIFICATION_TOOL } from './prompts';
import type { DocumentClassification, DocumentType, PreparedInput } from './types';

/**
 * Cheap + fast model for the classification stage. Routing 6
 * document classes is well within Haiku's strength; per-class
 * extraction uses Sonnet (see `extract.ts` constants).
 */
export const CLASSIFICATION_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Classification confidence threshold. Below this, IMP-04 must
 * surface the classification to the user for confirmation before
 * spending extraction tokens on a possibly-misclassified document.
 *
 * Starting threshold. Calibrate from real-world misclassification
 * rates once IMP-04 surfaces them. Raising = more user confirmations
 * for fewer wasted extractions; lowering = fewer interruptions but
 * more risk of wrong-class extraction.
 */
export const MIN_CLASSIFICATION_CONFIDENCE = 0.7;

/** Set of valid `DocumentType` values, in sync with the tool schema. */
const VALID_DOCUMENT_TYPES: ReadonlySet<DocumentType> = new Set([
  'lab-report',
  'doctor-letter',
  'prescription',
  'imaging-report',
  'insurer-app-export',
  'generic-medical-document',
]);

export interface ClassifyOptions {
  signal?: AbortSignal;
  /** Override the default classification model. */
  model?: string;
  /** Test escape hatch for `withRetry` delays. */
  retryDelay?: (ms: number) => Promise<void>;
}

/**
 * Result of `classifyDocument`. `uncertain` is true when the model's
 * self-reported confidence is below `MIN_CLASSIFICATION_CONFIDENCE`;
 * the caller (IMP-04 UI) should surface a "Is this a {type}?"
 * confirmation before proceeding to extraction.
 */
export interface ClassifyResult {
  classification: DocumentClassification;
  uncertain: boolean;
}

/**
 * Classify a `PreparedInput` into one of the six `DocumentType`
 * classes via Anthropic's tool_use mechanism (strict schema, no
 * free-form JSON parsing).
 *
 * Reads AI config via `readAIConfig`; throws `AiCallError` of kind
 * `'ai-config-missing'` if the user has not configured an API key.
 *
 * Network and rate-limit errors are retried with exponential
 * backoff (1s/2s/4s, max 3 attempts) via `withRetry`. Other error
 * classes (auth, content-policy, malformed-response, etc.) surface
 * immediately for caller-side actionable handling.
 */
export async function classifyDocument(
  input: PreparedInput,
  options: ClassifyOptions = {},
): Promise<ClassifyResult> {
  const config = await readAIConfig();
  if (!config) {
    throw new AiCallError('ai-config-missing');
  }
  const model = options.model ?? CLASSIFICATION_MODEL;

  const messages: AnthropicMessage[] = [{ role: 'user', content: buildContentBlocks(input) }];

  const result = await withRetry(
    async () => {
      try {
        return await requestCompletion({
          apiKey: config.apiKey,
          model,
          system: CLASSIFICATION_SYSTEM_PROMPT,
          messages,
          tools: [CLASSIFICATION_TOOL],
          toolChoice: { type: 'tool', name: CLASSIFICATION_TOOL.name },
          signal: options.signal,
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
    { signal: options.signal, delay: options.retryDelay },
  );

  if (result.stopReason === 'max_tokens') {
    throw new AiCallError('response-truncated');
  }

  const toolUse = pickToolUse(result.toolUses, CLASSIFICATION_TOOL.name);
  const classification = parseClassification(toolUse);
  return {
    classification,
    uncertain: (classification.confidence ?? 0) < MIN_CLASSIFICATION_CONFIDENCE,
  };
}

/**
 * Convert a `PreparedInput` into Anthropic content blocks.
 * - text mode → single text block
 * - image mode → text block + single image block
 * - multimodal → text block + N image blocks (PDF rasterization)
 */
export function buildContentBlocks(input: PreparedInput): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (input.mode === 'text') {
    blocks.push({ type: 'text', text: input.textContent });
    return blocks;
  }
  if (input.mode === 'image') {
    blocks.push({
      type: 'text',
      text: `Source file: ${input.sourceFile.name} (${input.sourceFile.type}).`,
    });
    blocks.push(arrayBufferToImageBlock(input.imageData, input.sourceFile.type));
    return blocks;
  }
  // multimodal: text plus per-page images
  blocks.push({
    type: 'text',
    text:
      input.textContent.length > 0
        ? `Source file: ${input.sourceFile.name} (${input.sourceFile.type}). ` +
          `Partial extracted text follows; full content rendered as page images below.\n\n${input.textContent}`
        : `Source file: ${input.sourceFile.name} (${input.sourceFile.type}). ` +
          `Pages rendered as images below.`,
  });
  for (const buf of input.imageData) {
    // Rasterized PDF pages are JPEG per IMP-02's rasterization choice.
    blocks.push(arrayBufferToImageBlock(buf, 'image/jpeg'));
  }
  return blocks;
}

function arrayBufferToImageBlock(buffer: ArrayBuffer, mimeType: string): ContentBlock {
  const mediaType = normalizeImageMediaType(mimeType);
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: arrayBufferToBase64(buffer),
    },
  };
}

function normalizeImageMediaType(
  mime: string,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  if (mime === 'image/png' || mime === 'image/webp' || mime === 'image/gif') return mime;
  return 'image/jpeg';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked to avoid String.fromCharCode call-stack limits on large
  // images (~64 KB at a time stays well under per-call arg limits).
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function pickToolUse(toolUses: readonly ToolUseBlock[], expectedName: string): ToolUseBlock {
  const match = toolUses.find((t) => t.name === expectedName);
  if (!match) {
    throw new AiCallError(
      'malformed-response',
      `Expected tool_use "${expectedName}" not found in model response`,
    );
  }
  return match;
}

function parseClassification(toolUse: ToolUseBlock): DocumentClassification {
  const input = toolUse.input as { type?: unknown; confidence?: unknown };
  const type = input.type;
  const confidence = input.confidence;
  if (typeof type !== 'string' || !VALID_DOCUMENT_TYPES.has(type as DocumentType)) {
    throw new AiCallError(
      'malformed-response',
      `Classification returned invalid type: ${String(type)}`,
    );
  }
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    throw new AiCallError(
      'malformed-response',
      `Classification missing valid confidence: ${String(confidence)}`,
    );
  }
  return { type: type as DocumentType, confidence };
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
