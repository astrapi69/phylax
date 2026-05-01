import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyKey } from './verifyKey';

type FetchSpy = ReturnType<typeof vi.fn>;

function setupFetch(): FetchSpy {
  const fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  return fetchSpy;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('verifyKey OpenAI-compatible', () => {
  it('returns ok when /models responds 200', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(new Response('{"data":[]}', { status: 200 }));

    const result = await verifyKey({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test',
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('ok');
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.openai.com/v1/models');
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
  });

  it('returns auth_error on 401', async () => {
    setupFetch().mockResolvedValue(
      new Response('{"error":{"message":"invalid"}}', { status: 401 }),
    );
    const result = await verifyKey({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'bad',
    });
    expect(result).toMatchObject({ ok: false, status: 'auth_error', detail: 'invalid' });
  });

  it('returns rate_limited on 429', async () => {
    setupFetch().mockResolvedValue(new Response('Slow down', { status: 429 }));
    const result = await verifyKey({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'k',
    });
    expect(result).toMatchObject({ ok: false, status: 'rate_limited' });
  });

  it('returns server_error on 5xx', async () => {
    setupFetch().mockResolvedValue(new Response('boom', { status: 503 }));
    const result = await verifyKey({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'k',
    });
    expect(result).toMatchObject({ ok: false, status: 'server_error' });
  });

  it('returns offline when fetch rejects', async () => {
    setupFetch().mockRejectedValue(new TypeError('network down'));
    const result = await verifyKey({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'k',
    });
    expect(result).toMatchObject({ ok: false, status: 'offline' });
  });

  it('omits Authorization when apiKey is empty (local providers)', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(new Response('{"data":[]}', { status: 200 }));
    await verifyKey({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      model: 'whatever',
      apiKey: '',
    });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('verifyKey Anthropic', () => {
  it('runs a 1-token /messages call and returns ok on success', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '' }],
          model: 'claude-haiku-4-5-20251001',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const result = await verifyKey({
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-haiku-4-5-20251001',
      apiKey: 'sk-ant-test',
    });
    expect(result.ok).toBe(true);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(1);
  });

  it('maps LLMError auth_error from the Anthropic adapter', async () => {
    setupFetch().mockResolvedValue(
      new Response('{"error":{"message":"bad key"}}', { status: 401 }),
    );
    const result = await verifyKey({
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-haiku-4-5-20251001',
      apiKey: 'bad',
    });
    expect(result).toMatchObject({ ok: false, status: 'auth_error', detail: 'bad key' });
  });

  it('uses the haiku fallback model when the config model is empty', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '' }],
          model: 'claude-haiku-4-5-20251001',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await verifyKey({
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      model: '',
      apiKey: 'sk',
    });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
  });
});

describe('verifyKey timeout', () => {
  it('returns timeout when the request is aborted', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockImplementation((_input: unknown, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      });
    });

    const result = await verifyKey(
      {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        apiKey: 'k',
      },
      50,
    );
    expect(result).toMatchObject({ ok: false, status: 'timeout' });
  });
});
