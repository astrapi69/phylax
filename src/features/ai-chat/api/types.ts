/**
 * Wire-format types for Anthropic's Messages API.
 *
 * The chat path (AI-05 through AI-08) uses string-content messages
 * exclusively. The document-import path (Phase 4b IMP-03) uses
 * content-block arrays for multimodal inputs (text + images) and
 * tool_use for structured output. Both shapes are accepted by
 * Anthropic's API; the union keeps the wire format type-safe at
 * call sites without breaking existing chat code.
 */

/** Content block types per Anthropic's Messages API spec. */
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
    data: string;
  };
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

/**
 * Message in the Anthropic Messages API format. System prompt is
 * passed separately via the `system` option.
 *
 * `content` accepts either a plain string (chat path, AI-05+) or an
 * array of content blocks (document-import path, IMP-03+). Both are
 * valid per Anthropic's API.
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

/**
 * Tool definition for tool_use structured output. Used by
 * `requestCompletion` (IMP-03) to force the model into a strict
 * schema instead of free-form JSON-in-text.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: readonly string[];
  };
}

/**
 * Structured error returned via the onError callback. The UI switches on
 * `kind` to render a consistent German message. `unknown` carries a message
 * string for debugging when the error is something we cannot categorize
 * (model not found, content policy violation, unexpected 4xx body).
 */
export type ChatError =
  | { kind: 'auth' }
  | { kind: 'rate-limit' }
  | { kind: 'server' }
  | { kind: 'network' }
  | { kind: 'unknown'; message: string };

export interface AnthropicStreamOptions {
  apiKey: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  /** Defaults to 4096. Raise only if conversations need longer replies. */
  maxTokens?: number;
  /** Fires for every text delta received via the SSE stream. */
  onToken: (token: string) => void;
  /** Fires exactly once when the stream ends cleanly (message_stop or EOF). */
  onComplete: (fullText: string) => void;
  /** Fires at most once when the call fails before or during streaming. */
  onError: (error: ChatError) => void;
  /** AbortSignal-triggered cancellation. Silent (no onError, no onComplete). */
  signal?: AbortSignal;
}

/**
 * Options for `requestCompletion` (IMP-03 non-streaming path).
 *
 * Differences vs `AnthropicStreamOptions`:
 * - No callbacks; returns a Promise resolved with the full response.
 * - Optional `tools` for tool_use structured output.
 * - Optional `tool_choice` to force the model to call a specific tool
 *   (used for classification + per-class extraction where exactly one
 *   tool call is expected).
 */
export interface RequestCompletionOptions {
  apiKey: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  tools?: ToolDefinition[];
  /** When set, forces the model to call the named tool. */
  toolChoice?: { type: 'tool'; name: string };
  signal?: AbortSignal;
}

/**
 * Result of a non-streaming `requestCompletion` call. Contains the
 * model's full text output (concatenated from all `text` blocks) plus
 * any `tool_use` blocks the model produced. Tool_use is the primary
 * IMP-03 consumption path; text is fallback / debugging.
 */
export interface RequestCompletionResult {
  textContent: string;
  toolUses: ToolUseBlock[];
  stopReason: string | null;
}
