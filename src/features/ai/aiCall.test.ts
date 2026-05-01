import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { aiStream } from './aiCall';
import type { AIProviderConfig } from '../../db/aiConfig';

type FetchSpy = ReturnType<typeof vi.fn>;

function setupFetch(): FetchSpy {
  const fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  return fetchSpy;
}

function sseResponse(events: string[]): Response {
  const text = events.map((e) => `data: ${e}`).join('\n\n') + '\n\n';
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const ANTHROPIC_CONFIG: AIProviderConfig = {
  provider: 'anthropic',
  apiKey: 'sk-ant-test',
  model: 'claude-sonnet-4-6',
  baseUrl: 'https://api.anthropic.com/v1',
};

const OPENAI_CONFIG: AIProviderConfig = {
  provider: 'openai',
  apiKey: 'sk-openai-test',
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aiStream Anthropic adapter', () => {
  it('streams content_block_delta events as onToken + fires onComplete with full text', async () => {
    setupFetch().mockResolvedValue(
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

    const tokens: string[] = [];
    let completedWith = '';
    const onError = vi.fn();
    await aiStream({
      config: ANTHROPIC_CONFIG,
      system: 'be terse',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (t) => tokens.push(t),
      onComplete: (full) => {
        completedWith = full;
      },
      onError,
    });

    expect(tokens).toEqual(['Hi ', 'there']);
    expect(completedWith).toBe('Hi there');
    expect(onError).not.toHaveBeenCalled();
  });

  it('passes the system prompt + messages to /v1/messages with x-api-key', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(sseResponse([JSON.stringify({ type: 'message_stop' })]));
    await aiStream({
      config: ANTHROPIC_CONFIG,
      system: 'pflegerin',
      messages: [{ role: 'user', content: 'hallo' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe('pflegerin');
    expect(body.messages).toEqual([{ role: 'user', content: 'hallo' }]);
  });
});

describe('aiStream OpenAI-compatible adapter', () => {
  it('streams choices[0].delta.content events as onToken + fires onComplete', async () => {
    setupFetch().mockResolvedValue(
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
        JSON.stringify({ choices: [{ delta: { content: ' world' } }] }),
        '[DONE]',
      ]),
    );
    const tokens: string[] = [];
    let completedWith = '';
    const onError = vi.fn();
    await aiStream({
      config: OPENAI_CONFIG,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (t) => tokens.push(t),
      onComplete: (full) => {
        completedWith = full;
      },
      onError,
    });
    expect(tokens).toEqual(['Hello', ' world']);
    expect(completedWith).toBe('Hello world');
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('aiStream error mapping (LLMError -> ChatError)', () => {
  it('401 maps to { kind: "auth" }', async () => {
    setupFetch().mockResolvedValue(
      new Response('{"error":{"message":"bad key"}}', { status: 401 }),
    );
    const onError = vi.fn();
    await aiStream({
      config: ANTHROPIC_CONFIG,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith({ kind: 'auth' });
  });

  it('429 maps to { kind: "rate-limit" }', async () => {
    setupFetch().mockResolvedValue(new Response('Slow down', { status: 429 }));
    const onError = vi.fn();
    await aiStream({
      config: OPENAI_CONFIG,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith({ kind: 'rate-limit' });
  });

  it('5xx maps to { kind: "server" }', async () => {
    setupFetch().mockResolvedValue(new Response('boom', { status: 503 }));
    const onError = vi.fn();
    await aiStream({
      config: OPENAI_CONFIG,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith({ kind: 'server' });
  });

  it('network throw maps to { kind: "network" }', async () => {
    setupFetch().mockRejectedValue(new TypeError('fetch failed'));
    const onError = vi.fn();
    await aiStream({
      config: OPENAI_CONFIG,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith({ kind: 'network' });
  });

  it('400 invalid_request maps to { kind: "unknown", message }', async () => {
    setupFetch().mockResolvedValue(
      new Response('{"error":{"message":"bad request body"}}', { status: 400 }),
    );
    const onError = vi.fn();
    await aiStream({
      config: ANTHROPIC_CONFIG,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith({ kind: 'unknown', message: 'bad request body' });
  });
});

describe('aiStream silent abort', () => {
  it('does not fire onComplete or onError after AbortSignal', async () => {
    setupFetch().mockImplementation((_input: unknown, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      });
    });

    const controller = new AbortController();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const promise = aiStream({
      config: ANTHROPIC_CONFIG,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
      onToken: vi.fn(),
      onComplete,
      onError,
    });
    controller.abort();
    await promise;
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('aiStream model + baseUrl resolution', () => {
  it('uses config.baseUrl when supplied', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(sseResponse([JSON.stringify({ type: 'message_stop' })]));
    await aiStream({
      config: { ...ANTHROPIC_CONFIG, baseUrl: 'https://my-proxy.example.com/v1' },
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://my-proxy.example.com/v1/messages');
  });

  it("uses the active provider's preset baseUrl when config.baseUrl is absent", async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(sseResponse([JSON.stringify({ type: 'message_stop' })]));
    await aiStream({
      config: { provider: 'anthropic', apiKey: 'k', model: 'm' },
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('uses DEFAULT_ANTHROPIC_MODEL when anthropic config.model is absent', async () => {
    const fetchSpy = setupFetch();
    fetchSpy.mockResolvedValue(sseResponse([JSON.stringify({ type: 'message_stop' })]));
    await aiStream({
      config: { provider: 'anthropic', apiKey: 'k' },
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('claude-sonnet-4-6');
  });
});
