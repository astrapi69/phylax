/**
 * Message in the Anthropic Messages API format.
 * System prompt is passed separately via the `system` option.
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
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
