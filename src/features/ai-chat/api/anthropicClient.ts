import type { AnthropicStreamOptions, ChatError } from './types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Stream a Messages API completion from Anthropic.
 *
 * The only network call in the AI-chat feature. Called from useChat exactly
 * when the user sends a message (satisfies AI-10: no background calls).
 *
 * Browser-origin calls require the `anthropic-dangerous-direct-browser-access`
 * header. This acknowledges that the API key is exposed in the browser, which
 * is consistent with Phylax's local-first model (no backend proxy; user
 * supplies their own key and consents via the AI-02 disclaimer).
 *
 * Cancellation via AbortSignal is silent: neither onComplete nor onError
 * fires. The caller that issued `abort()` is responsible for its own cleanup.
 */
export async function streamCompletion(options: AnthropicStreamOptions): Promise<void> {
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
      body: JSON.stringify({
        model: options.model,
        system: options.system,
        messages: options.messages,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        stream: true,
      }),
      signal: options.signal,
    });
  } catch (err) {
    if (isAbortError(err)) return;
    options.onError({ kind: 'network' });
    return;
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    options.onError(mapHttpError(response.status, bodyText));
    return;
  }

  if (!response.body) {
    options.onError({ kind: 'unknown', message: 'Empty response body' });
    return;
  }

  try {
    await consumeStream(response.body, options);
  } catch (err) {
    if (isAbortError(err)) return;
    options.onError({
      kind: 'unknown',
      message: err instanceof Error ? err.message : 'Stream error',
    });
  }
}

/**
 * Read an SSE stream, buffer partial lines across chunks, and dispatch
 * content deltas. Anthropic's event framing uses a blank line (`\n\n`) to
 * delimit events, and a single event can be split across multiple chunks
 * on slow or fragmented connections. The line buffer prevents data loss.
 */
async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  options: AnthropicStreamOptions,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let state: 'running' | 'completed' | 'failed' = 'running';

  try {
    while (state === 'running') {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1 && state === 'running') {
        const eventText = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const payload = extractDataPayload(eventText);
        if (payload !== null) {
          const result = handleEvent(payload, fullText, options);
          if (result.kind === 'token') {
            fullText = result.fullText;
          } else if (result.kind === 'complete') {
            options.onComplete(fullText);
            state = 'completed';
          } else if (result.kind === 'error') {
            options.onError(result.error);
            state = 'failed';
          }
        }

        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Stream ended without an explicit message_stop and without error.
  // Surface what we accumulated so the UI is not stuck in a streaming state.
  if (state === 'running') {
    options.onComplete(fullText);
  }
}

/** Extract the payload from the first `data:` line in an SSE event block. */
function extractDataPayload(eventText: string): string | null {
  for (const line of eventText.split('\n')) {
    if (line.startsWith('data:')) {
      return line.slice('data:'.length).trim();
    }
  }
  return null;
}

type EventResult =
  | { kind: 'noop' }
  | { kind: 'token'; fullText: string }
  | { kind: 'complete' }
  | { kind: 'error'; error: ChatError };

function handleEvent(
  payload: string,
  fullText: string,
  options: AnthropicStreamOptions,
): EventResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { kind: 'noop' };
  }

  if (!isObject(parsed)) return { kind: 'noop' };
  const type = parsed['type'];

  if (type === 'content_block_delta') {
    const delta = parsed['delta'];
    if (isObject(delta) && delta['type'] === 'text_delta' && typeof delta['text'] === 'string') {
      const token = delta['text'];
      options.onToken(token);
      return { kind: 'token', fullText: fullText + token };
    }
    return { kind: 'noop' };
  }

  if (type === 'message_stop') {
    return { kind: 'complete' };
  }

  if (type === 'error') {
    const errorBody = parsed['error'];
    const message =
      isObject(errorBody) && typeof errorBody['message'] === 'string'
        ? errorBody['message']
        : 'Stream error';
    return { kind: 'error', error: { kind: 'unknown', message } };
  }

  // message_start, content_block_start, content_block_stop, message_delta,
  // ping, and anything else we do not care about.
  return { kind: 'noop' };
}

function mapHttpError(status: number, bodyText: string): ChatError {
  if (status === 401 || status === 403) return { kind: 'auth' };
  if (status === 429) return { kind: 'rate-limit' };
  if (status >= 500 && status < 600) return { kind: 'server' };
  return { kind: 'unknown', message: parseAnthropicErrorMessage(bodyText, status) };
}

function parseAnthropicErrorMessage(bodyText: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (isObject(parsed) && isObject(parsed['error'])) {
      const msg = (parsed['error'] as Record<string, unknown>)['message'];
      if (typeof msg === 'string' && msg.length > 0) return msg;
    }
  } catch {
    // Fall through to the status-only fallback.
  }
  return `HTTP ${status}`;
}

function isAbortError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  return (err as { name?: unknown }).name === 'AbortError';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
