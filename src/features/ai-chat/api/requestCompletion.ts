import type {
  ChatError,
  ContentBlock,
  RequestCompletionOptions,
  RequestCompletionResult,
  ToolUseBlock,
} from './types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Non-streaming Messages API call.
 *
 * Companion to `streamCompletion` for use cases that consume the
 * full response in one shot rather than rendering a token stream.
 * Designed for IMP-03's classification + extraction calls where the
 * caller awaits a single structured `tool_use` response and renders
 * the result in one render pass.
 *
 * Why a separate function instead of wrapping `streamCompletion`:
 * - Different control shape (Promise vs callbacks).
 * - Different request body (`stream: false`, optional `tools` and
 *   `tool_choice`).
 * - Wrapping would create a leaky abstraction where the caller sees
 *   a Promise but the underlying SSE machinery still runs.
 *
 * Browser-origin call uses the same
 * `anthropic-dangerous-direct-browser-access` header as the chat
 * path (Phylax's local-first model: user supplies their own key,
 * no backend proxy).
 *
 * Cancellation via `AbortSignal` rejects the returned Promise with
 * an `AbortError` so callers can `try/catch` cleanup paths.
 *
 * Errors are thrown as `ChatError`-shaped objects (caller switches
 * on `kind`); the orchestrator (IMP-03 `aiCallError.ts`) maps these
 * to `AiCallError` with localized messaging + retry policy.
 */
export async function requestCompletion(
  options: RequestCompletionOptions,
): Promise<RequestCompletionResult> {
  const body: Record<string, unknown> = {
    model: options.model,
    system: options.system,
    messages: options.messages,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: false,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }
  if (options.toolChoice) {
    body.tool_choice = options.toolChoice;
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw networkError();
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw mapHttpError(response.status, text);
  }

  let parsed: AnthropicMessageResponse;
  try {
    parsed = (await response.json()) as AnthropicMessageResponse;
  } catch (err) {
    throw unknownError(err instanceof Error ? err.message : 'JSON parse failed');
  }

  return parseResponse(parsed);
}

interface AnthropicMessageResponse {
  content: ContentBlock[];
  stop_reason?: string | null;
}

function parseResponse(parsed: AnthropicMessageResponse): RequestCompletionResult {
  const textParts: string[] = [];
  const toolUses: ToolUseBlock[] = [];
  for (const block of parsed.content ?? []) {
    if (block.type === 'text') {
      textParts.push(block.text);
    } else if (block.type === 'tool_use') {
      toolUses.push(block);
    }
  }
  return {
    textContent: textParts.join(''),
    toolUses,
    stopReason: parsed.stop_reason ?? null,
  };
}

function mapHttpError(status: number, _body: string): ChatError {
  if (status === 401 || status === 403) return { kind: 'auth' };
  if (status === 429) return { kind: 'rate-limit' };
  if (status >= 500) return { kind: 'server' };
  return { kind: 'unknown', message: `HTTP ${status}` };
}

function networkError(): ChatError {
  return { kind: 'network' };
}

function unknownError(message: string): ChatError {
  return { kind: 'unknown', message };
}

function isAbortError(err: unknown): boolean {
  // DOMException in jsdom doesn't always inherit from Error, so check
  // the `name` property directly without an `instanceof Error` guard.
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}
