import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamCompletion } from './anthropicClient';
import type { ChatError } from './types';

/**
 * Build a Response whose body is an SSE stream made of the given chunks.
 * Each chunk is emitted as one ReadableStream enqueue; tests that care about
 * chunk boundaries pass a pre-split payload to verify the line buffer.
 */
function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function deltaEvent(text: string): string {
  return `event: content_block_delta\ndata: ${JSON.stringify({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text },
  })}\n\n`;
}

const STOP_EVENT = `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`;

function baseOptions() {
  return {
    apiKey: 'sk-ant-test-key-012345',
    model: 'claude-sonnet-4-20250514',
    system: 'You are a test.',
    messages: [{ role: 'user' as const, content: 'hi' }],
    onToken: vi.fn<(token: string) => void>(),
    onComplete: vi.fn<(fullText: string) => void>(),
    onError: vi.fn<(error: ChatError) => void>(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('streamCompletion - request shape', () => {
  it('sends the required headers', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(sseResponse([deltaEvent('hi'), STOP_EVENT]));

    await streamCompletion(baseOptions());

    expect(fetchSpy).toHaveBeenCalledOnce();
    const args = fetchSpy.mock.calls[0];
    if (!args) throw new Error('expected fetch call args');
    const [url, init] = args;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-api-key']).toBe('sk-ant-test-key-012345');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('sends the expected body (stream=true, model, system, messages, max_tokens)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(sseResponse([deltaEvent('x'), STOP_EVENT]));

    await streamCompletion({ ...baseOptions(), maxTokens: 2048 });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: 'claude-sonnet-4-20250514',
      system: 'You are a test.',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 2048,
      stream: true,
    });
  });

  it('defaults max_tokens to 4096 when not provided', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(sseResponse([deltaEvent('x'), STOP_EVENT]));

    await streamCompletion(baseOptions());

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(4096);
  });
});

describe('streamCompletion - SSE parsing', () => {
  it('emits each text delta via onToken and the full text via onComplete', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([deltaEvent('Hallo'), deltaEvent(' Welt'), STOP_EVENT]),
    );
    const opts = baseOptions();

    await streamCompletion(opts);

    expect(opts.onToken).toHaveBeenCalledTimes(2);
    expect(opts.onToken).toHaveBeenNthCalledWith(1, 'Hallo');
    expect(opts.onToken).toHaveBeenNthCalledWith(2, ' Welt');
    expect(opts.onComplete).toHaveBeenCalledWith('Hallo Welt');
    expect(opts.onError).not.toHaveBeenCalled();
  });

  it('falls back to onComplete(fullText) when the stream ends without message_stop', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([deltaEvent('partial')]));
    const opts = baseOptions();

    await streamCompletion(opts);

    expect(opts.onComplete).toHaveBeenCalledWith('partial');
  });

  it('ignores unrelated event types (ping, message_start, content_block_start)', async () => {
    const pingEvent = `event: ping\ndata: ${JSON.stringify({ type: 'ping' })}\n\n`;
    const startEvent = `event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: { id: 'msg_1' },
    })}\n\n`;
    const blockStart = `event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
    })}\n\n`;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([startEvent, blockStart, pingEvent, deltaEvent('ok'), STOP_EVENT]),
    );
    const opts = baseOptions();

    await streamCompletion(opts);

    expect(opts.onToken).toHaveBeenCalledOnce();
    expect(opts.onToken).toHaveBeenCalledWith('ok');
    expect(opts.onComplete).toHaveBeenCalledWith('ok');
  });

  it('surfaces a mid-stream error event as ChatError.unknown with the message', async () => {
    const errorEvent = `event: error\ndata: ${JSON.stringify({
      type: 'error',
      error: { type: 'overloaded_error', message: 'Server overloaded' },
    })}\n\n`;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([deltaEvent('before'), errorEvent, STOP_EVENT]),
    );
    const opts = baseOptions();

    await streamCompletion(opts);

    expect(opts.onError).toHaveBeenCalledWith({
      kind: 'unknown',
      message: 'Server overloaded',
    });
    // After a stream error, onComplete must NOT fire
    expect(opts.onComplete).not.toHaveBeenCalled();
  });

  it('silently skips malformed JSON in SSE data lines', async () => {
    const malformed = 'event: content_block_delta\ndata: {not json\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([malformed, deltaEvent('recovered'), STOP_EVENT]),
    );
    const opts = baseOptions();

    await streamCompletion(opts);

    expect(opts.onToken).toHaveBeenCalledOnce();
    expect(opts.onToken).toHaveBeenCalledWith('recovered');
    expect(opts.onError).not.toHaveBeenCalled();
  });
});

describe('streamCompletion - chunk-boundary handling', () => {
  it('reconstructs events split across arbitrary byte boundaries', async () => {
    // One event split into every possible byte-wise boundary + another event
    // joined in the final chunk. This verifies the line buffer holds partial
    // lines across reads.
    const event = deltaEvent('Hallo Welt');
    const chunks: string[] = [];
    chunks.push(event.slice(0, 5));
    chunks.push(event.slice(5, 20));
    chunks.push(event.slice(20, 50));
    chunks.push(event.slice(50));
    chunks.push(STOP_EVENT);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse(chunks));
    const opts = baseOptions();

    await streamCompletion(opts);

    expect(opts.onToken).toHaveBeenCalledOnce();
    expect(opts.onToken).toHaveBeenCalledWith('Hallo Welt');
    expect(opts.onComplete).toHaveBeenCalledWith('Hallo Welt');
  });

  it('handles the double-newline delimiter being split between chunks', async () => {
    const event = deltaEvent('a');
    // Split exactly at "\n\n" so the terminator spans the boundary.
    const splitIndex = event.length - 1;
    const chunks = [event.slice(0, splitIndex), event.slice(splitIndex), STOP_EVENT];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse(chunks));
    const opts = baseOptions();

    await streamCompletion(opts);

    expect(opts.onToken).toHaveBeenCalledWith('a');
    expect(opts.onComplete).toHaveBeenCalledWith('a');
  });
});

describe('streamCompletion - HTTP errors', () => {
  it('401 maps to ChatError.auth', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse('', 401));
    const opts = baseOptions();
    await streamCompletion(opts);
    expect(opts.onError).toHaveBeenCalledWith({ kind: 'auth' });
  });

  it('403 also maps to ChatError.auth', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse('', 403));
    const opts = baseOptions();
    await streamCompletion(opts);
    expect(opts.onError).toHaveBeenCalledWith({ kind: 'auth' });
  });

  it('429 maps to ChatError.rate-limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse('', 429));
    const opts = baseOptions();
    await streamCompletion(opts);
    expect(opts.onError).toHaveBeenCalledWith({ kind: 'rate-limit' });
  });

  it('500/502/503/504 map to ChatError.server', async () => {
    for (const status of [500, 502, 503, 504]) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(textResponse('', status));
      const opts = baseOptions();
      await streamCompletion(opts);
      expect(opts.onError).toHaveBeenCalledWith({ kind: 'server' });
    }
  });

  it('400 with JSON error body maps to unknown with the parsed message', async () => {
    const body = JSON.stringify({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'model not found' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse(body, 400));
    const opts = baseOptions();
    await streamCompletion(opts);
    expect(opts.onError).toHaveBeenCalledWith({
      kind: 'unknown',
      message: 'model not found',
    });
  });

  it('400 with unparseable body falls back to "HTTP 400"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse('not json', 400));
    const opts = baseOptions();
    await streamCompletion(opts);
    expect(opts.onError).toHaveBeenCalledWith({
      kind: 'unknown',
      message: 'HTTP 400',
    });
  });
});

describe('streamCompletion - network and abort', () => {
  it('fetch rejection maps to ChatError.network', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const opts = baseOptions();
    await streamCompletion(opts);
    expect(opts.onError).toHaveBeenCalledWith({ kind: 'network' });
  });

  it('AbortError during fetch is silent (no onError, no onComplete)', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);
    const opts = baseOptions();
    await streamCompletion(opts);
    expect(opts.onError).not.toHaveBeenCalled();
    expect(opts.onComplete).not.toHaveBeenCalled();
  });

  it('AbortError surfacing from the stream reader is silent', async () => {
    // Simulate an aborted read: first pull enqueues a valid delta, second
    // pull errors with an AbortError so the next read() rejects. Our client
    // must swallow it without reaching onError.
    const encoder = new TextEncoder();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(streamController) {
        pulls += 1;
        if (pulls === 1) {
          streamController.enqueue(encoder.encode(deltaEvent('partial')));
        } else {
          streamController.error(new DOMException('aborted', 'AbortError'));
        }
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    );

    const opts = baseOptions();
    await streamCompletion(opts);

    expect(opts.onError).not.toHaveBeenCalled();
    // The partial delta delivered before the abort still fired onToken.
    expect(opts.onToken).toHaveBeenCalledWith('partial');
  });
});
