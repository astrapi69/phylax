/**
 * Browser-side multi-provider LLM client.
 *
 * Two adapters:
 *  - OpenAI-compatible (OpenAI, Gemini, Mistral, LM Studio, Ollama, custom)
 *  - Anthropic native /v1/messages
 *
 * CORS reality: see `providers.ts` `corsHint`. Most cloud providers
 * BLOCK browser CORS. Anthropic works only with the
 * `anthropic-dangerous-direct-browser-access: true` opt-in header,
 * which exposes the key in DevTools -- acceptable for Phylax's
 * "bring your own key" model, NOT for a multi-tenant SaaS.
 *
 * Streaming: SSE for both adapters. Use `stream(...)` to opt in.
 *
 * Lifted from the Bibliogon donor module on 2026-05-01. Phylax-
 * specific changes: single-quote string style, no other behavioural
 * differences.
 */

import { detectProvider } from './providers';

export class LLMError extends Error {
  status: string;
  detail: string;
  constructor(status: string, detail: string) {
    super(`${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

export interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  /** Override auto-detection; 'anthropic' forces native API path. */
  provider?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export class LLMClient {
  private baseUrl: string;
  private model: string;
  private apiKey: string;
  private temperature: number;
  private maxTokens: number;
  private provider: string;

  constructor(config: LLMConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.provider = config.provider || detectProvider(this.baseUrl);
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    if (this.provider === 'anthropic') {
      return this.chatAnthropic(messages, opts);
    }
    return this.chatOpenAI(messages, opts);
  }

  async *stream(messages: ChatMessage[], opts: ChatOptions = {}): AsyncGenerator<StreamChunk> {
    if (this.provider === 'anthropic') {
      yield* this.streamAnthropic(messages, opts);
      return;
    }
    yield* this.streamOpenAI(messages, opts);
  }

  private async chatOpenAI(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    const payload = {
      model: opts.model || this.model,
      messages,
      temperature: opts.temperature ?? this.temperature,
      max_tokens: opts.maxTokens || this.maxTokens,
      stream: false,
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const response = await this.postJson('/chat/completions', payload, headers, opts.signal);
    const result = await response.json();
    const choice = result.choices?.[0];
    if (!choice) throw new LLMError('invalid_response', 'No choices returned');
    return {
      content: (choice.message?.content || '').trim(),
      model: result.model || payload.model,
      usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  private async chatAnthropic(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    const { systemText, conversation } = splitSystem(messages);
    const payload: Record<string, unknown> = {
      model: opts.model || this.model,
      messages: conversation,
      max_tokens: opts.maxTokens || this.maxTokens || 2048,
      temperature: opts.temperature ?? this.temperature,
    };
    if (systemText) payload.system = systemText;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    const response = await this.postJson('/messages', payload, headers, opts.signal);
    const result = await response.json();
    const blocks = (result.content || []) as Array<{ type: string; text?: string }>;
    const content = blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('\n')
      .trim();
    const usage = result.usage || { input_tokens: 0, output_tokens: 0 };
    return {
      content,
      model: result.model || (payload.model as string),
      usage: {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
    };
  }

  private async *streamOpenAI(
    messages: ChatMessage[],
    opts: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    const payload = {
      model: opts.model || this.model,
      messages,
      temperature: opts.temperature ?? this.temperature,
      max_tokens: opts.maxTokens || this.maxTokens,
      stream: true,
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const response = await this.postJson('/chat/completions', payload, headers, opts.signal);
    for await (const event of parseSSE(response)) {
      if (event === '[DONE]') {
        yield { delta: '', done: true };
        return;
      }
      try {
        const parsed = JSON.parse(event);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) yield { delta, done: false };
      } catch {
        // ignore malformed lines
      }
    }
    yield { delta: '', done: true };
  }

  private async *streamAnthropic(
    messages: ChatMessage[],
    opts: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    const { systemText, conversation } = splitSystem(messages);
    const payload: Record<string, unknown> = {
      model: opts.model || this.model,
      messages: conversation,
      max_tokens: opts.maxTokens || this.maxTokens || 2048,
      temperature: opts.temperature ?? this.temperature,
      stream: true,
    };
    if (systemText) payload.system = systemText;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    const response = await this.postJson('/messages', payload, headers, opts.signal);
    for await (const event of parseSSE(response)) {
      try {
        const parsed = JSON.parse(event);
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          yield { delta: parsed.delta.text || '', done: false };
        } else if (parsed.type === 'message_stop') {
          yield { delta: '', done: true };
          return;
        }
      } catch {
        // ignore
      }
    }
    yield { delta: '', done: true };
  }

  private async postJson(
    path: string,
    body: unknown,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      // Preserve AbortError so callers can distinguish a deliberate
      // cancellation (silent path: no UI error rendered) from a
      // genuine network failure. Wrapping into LLMError('offline')
      // would hide the abort semantics from `aiCall` and from any
      // future cancellation-aware caller.
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new LLMError('offline', `Cannot reach ${this.baseUrl}: ${msg}`);
    }
    if (response.ok) return response;
    const text = await response.text().catch(() => '');
    let detail = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message || parsed.detail || parsed.message || detail;
    } catch {
      // keep raw text slice
    }
    if (response.status === 401 || response.status === 403) {
      throw new LLMError('auth_error', detail || 'API key invalid');
    }
    if (response.status === 429) {
      throw new LLMError('rate_limited', detail || 'Rate limit reached');
    }
    if (response.status === 404) {
      throw new LLMError('model_not_found', detail || 'Model not found');
    }
    if (response.status === 400) {
      throw new LLMError('invalid_request', detail || 'Bad request');
    }
    if (response.status >= 500) {
      throw new LLMError('server_error', detail || `Server error (HTTP ${response.status})`);
    }
    throw new LLMError('error', detail || `HTTP ${response.status}`);
  }
}

function splitSystem(messages: ChatMessage[]): { systemText: string; conversation: ChatMessage[] } {
  let systemText = '';
  const conversation: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText = msg.content;
    } else {
      conversation.push(msg);
    }
  }
  if (conversation.length === 0) {
    conversation.push({ role: 'user', content: '' });
  }
  return { systemText, conversation };
}

async function* parseSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = event
        .split('\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6))
        .join('\n');
      if (data) yield data;
    }
  }
}
