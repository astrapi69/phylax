import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestCompletion } from './requestCompletion';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

beforeEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

describe('requestCompletion', () => {
  it('POSTs to Messages API with stream=false and returns text + tool_uses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        content: [
          { type: 'text', text: 'thinking…' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'classify_document',
            input: { type: 'lab-report', confidence: 0.9 },
          },
        ],
        stop_reason: 'tool_use',
      }),
    );

    const result = await requestCompletion({
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-6',
      system: 'sys',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) throw new Error('expected fetch call');
    const [url, init] = firstCall;
    expect(url).toBe(ANTHROPIC_URL);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.stream).toBe(false);
    expect(body.model).toBe('claude-sonnet-4-6');
    expect(result.textContent).toBe('thinking…');
    expect(result.toolUses).toHaveLength(1);
    expect(result.toolUses[0]?.name).toBe('classify_document');
    expect(result.stopReason).toBe('tool_use');
  });

  it('forwards tools and tool_choice to the request body when provided', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ content: [] }));

    await requestCompletion({
      apiKey: 'k',
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
      tools: [
        {
          name: 'f',
          description: 'd',
          input_schema: { type: 'object', properties: {} },
        },
      ],
      toolChoice: { type: 'tool', name: 'f' },
    });

    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch call');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'f' });
  });

  it('omits tools and tool_choice when not provided', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ content: [] }));

    await requestCompletion({
      apiKey: 'k',
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
    });

    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch call');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('throws ChatError network on fetch rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(
      requestCompletion({
        apiKey: 'k',
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'x' }],
      }),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('throws ChatError auth on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('unauthorized', { status: 401 }),
    );
    await expect(
      requestCompletion({
        apiKey: 'k',
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'x' }],
      }),
    ).rejects.toMatchObject({ kind: 'auth' });
  });

  it('throws ChatError rate-limit on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('rate limit', { status: 429 }),
    );
    await expect(
      requestCompletion({
        apiKey: 'k',
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'x' }],
      }),
    ).rejects.toMatchObject({ kind: 'rate-limit' });
  });

  it('throws ChatError server on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('boom', { status: 503 }));
    await expect(
      requestCompletion({
        apiKey: 'k',
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'x' }],
      }),
    ).rejects.toMatchObject({ kind: 'server' });
  });

  it('propagates AbortError when signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      const sig = (init as RequestInit | undefined)?.signal as AbortSignal | undefined;
      if (sig?.aborted) throw new DOMException('aborted', 'AbortError');
      return jsonResponse({ content: [] });
    });

    await expect(
      requestCompletion({
        apiKey: 'k',
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'x' }],
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
