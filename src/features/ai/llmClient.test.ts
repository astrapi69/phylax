import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMClient, LLMError } from './llmClient';

type FetchSpy = ReturnType<typeof vi.fn>;

function setupFetch(): FetchSpy {
  const fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  return fetchSpy;
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(events: string[]): Response {
  const text = events.map((e) => `data: ${e}`).join('\n\n') + '\n\n';
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const OPENAI_BASE = 'https://api.openai.com/v1';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LLMClient adapter selection', () => {
  it('routes by detectProvider when no explicit provider is supplied', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: 'hi' }],
        model: 'claude-x',
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );
    const client = new LLMClient({
      baseUrl: ANTHROPIC_BASE,
      model: 'claude-sonnet-4-20250514',
      apiKey: 'sk-ant-test',
      temperature: 0,
      maxTokens: 100,
    });
    await client.chat([{ role: 'user', content: 'hi' }]);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe(`${ANTHROPIC_BASE}/messages`);
  });

  it("explicit `provider: 'anthropic'` overrides URL detection", async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: 'ok' }],
        model: 'm',
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    );
    const client = new LLMClient({
      baseUrl: 'https://my-proxy.example.com/v1',
      model: 'm',
      apiKey: 'k',
      temperature: 0,
      maxTokens: 100,
      provider: 'anthropic',
    });
    await client.chat([{ role: 'user', content: 'hi' }]);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url.endsWith('/messages')).toBe(true);
  });

  it('strips trailing slashes from the supplied baseUrl', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'ok' } }], model: 'gpt-x', usage: {} }),
    );
    const client = new LLMClient({
      baseUrl: `${OPENAI_BASE}/////`,
      model: 'gpt-4o',
      apiKey: 'sk-test',
      temperature: 0,
      maxTokens: 100,
    });
    await client.chat([{ role: 'user', content: 'hi' }]);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe(`${OPENAI_BASE}/chat/completions`);
  });
});

describe('LLMClient.chat OpenAI adapter', () => {
  it('sends model + messages + Bearer auth on /chat/completions', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'hello world' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      }),
    );
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt-4o',
      apiKey: 'sk-openai-test',
      temperature: 0.5,
      maxTokens: 200,
    });
    const result = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('hello world');
    expect(result.model).toBe('gpt-4o');
    expect(result.usage.prompt_tokens).toBe(5);

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-openai-test');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o');
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(200);
  });

  it('throws LLMError for missing choices in the response', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(jsonResponse({ choices: [] }));
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt-4o',
      apiKey: 'sk',
      temperature: 0,
      maxTokens: 100,
    });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(LLMError);
  });
});

describe('LLMClient.chat Anthropic adapter', () => {
  it('sends model + system + messages + x-api-key on /messages', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      jsonResponse({
        content: [
          { type: 'text', text: 'hello' },
          { type: 'tool_use', text: 'noise' },
        ],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 4, output_tokens: 2 },
      }),
    );
    const client = new LLMClient({
      baseUrl: ANTHROPIC_BASE,
      model: 'claude-sonnet-4-20250514',
      apiKey: 'sk-ant-test',
      temperature: 0,
      maxTokens: 100,
    });
    const result = await client.chat([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'hi' },
    ]);
    expect(result.content).toBe('hello');
    expect(result.usage.prompt_tokens).toBe(4);
    expect(result.usage.completion_tokens).toBe(2);
    expect(result.usage.total_tokens).toBe(6);

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe('be terse');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('synthesizes an empty user turn when only a system message is passed', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: '' }],
        model: 'm',
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    );
    const client = new LLMClient({
      baseUrl: ANTHROPIC_BASE,
      model: 'm',
      apiKey: 'k',
      temperature: 0,
      maxTokens: 100,
    });
    await client.chat([{ role: 'system', content: 's' }]);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: 'user', content: '' }]);
  });
});

describe('LLMClient HTTP error mapping', () => {
  it('maps 401 to auth_error', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      new Response('{"error":{"message":"invalid key"}}', { status: 401 }),
    );
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt',
      apiKey: 'k',
      temperature: 0,
      maxTokens: 1,
    });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      status: 'auth_error',
      detail: 'invalid key',
    });
  });

  it('maps 429 to rate_limited', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(new Response('Slow down', { status: 429 }));
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt',
      apiKey: 'k',
      temperature: 0,
      maxTokens: 1,
    });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      status: 'rate_limited',
    });
  });

  it('maps 404 to model_not_found', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(new Response('not found', { status: 404 }));
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'no-such-model',
      apiKey: 'k',
      temperature: 0,
      maxTokens: 1,
    });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      status: 'model_not_found',
    });
  });

  it('maps 500 to server_error', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(new Response('boom', { status: 500 }));
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt',
      apiKey: 'k',
      temperature: 0,
      maxTokens: 1,
    });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      status: 'server_error',
    });
  });

  it('maps a network failure to offline', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt',
      apiKey: 'k',
      temperature: 0,
      maxTokens: 1,
    });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      status: 'offline',
    });
  });
});

describe('LLMClient.stream', () => {
  it('OpenAI adapter yields delta chunks then done', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }),
        '[DONE]',
      ]),
    );
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt-4o',
      apiKey: 'sk',
      temperature: 0,
      maxTokens: 100,
    });
    const chunks: { delta: string; done: boolean }[] = [];
    for await (const chunk of client.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([
      { delta: 'Hel', done: false },
      { delta: 'lo', done: false },
      { delta: '', done: true },
    ]);
  });

  it('Anthropic adapter yields content_block_delta + message_stop', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      sseResponse([
        JSON.stringify({ type: 'message_start' }),
        JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi ' } }),
        JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'there' },
        }),
        JSON.stringify({ type: 'message_stop' }),
      ]),
    );
    const client = new LLMClient({
      baseUrl: ANTHROPIC_BASE,
      model: 'claude-x',
      apiKey: 'sk-ant',
      temperature: 0,
      maxTokens: 100,
    });
    const chunks: { delta: string; done: boolean }[] = [];
    for await (const chunk of client.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([
      { delta: 'Hi ', done: false },
      { delta: 'there', done: false },
      { delta: '', done: true },
    ]);
  });

  it('OpenAI adapter ignores malformed SSE lines without aborting', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      sseResponse([
        'this is not json',
        JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
        '[DONE]',
      ]),
    );
    const client = new LLMClient({
      baseUrl: OPENAI_BASE,
      model: 'gpt-4o',
      apiKey: 'sk',
      temperature: 0,
      maxTokens: 100,
    });
    const out: string[] = [];
    for await (const chunk of client.stream([{ role: 'user', content: 'hi' }])) {
      if (chunk.delta) out.push(chunk.delta);
    }
    expect(out).toEqual(['ok']);
  });
});
