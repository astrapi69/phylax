import { LLMClient, LLMError } from './llmClient';
import { getProviderPreset } from './providers';
import type { AIProvider, AIProviderConfig } from '../../db/aiConfig';
import { DEFAULT_ANTHROPIC_MODEL } from '../../db/aiConfig';
import type { ChatError } from '../ai-chat/api/types';

/**
 * Streaming text completion against the user's active AI provider.
 *
 * SCOPE: TEXT-ONLY streaming. Routes through `LLMClient.stream()`
 * which handles SSE for both Anthropic native (`/v1/messages`) and
 * OpenAI-compatible (`/v1/chat/completions`) endpoints.
 *
 * This helper does NOT support:
 *   - tool_use / structured output (use `requestCompletion` from
 *     `src/features/ai-chat/api/`; that path is intentionally
 *     Anthropic-only because tool-call shapes differ across
 *     providers and a generic abstraction is a future task)
 *   - multimodal content blocks (images, ToolResultBlock, etc.)
 *   - stop_reason inspection (max_tokens truncation detection)
 *
 * If a future caller needs structured output across multiple
 * providers, design a separate generic abstraction; do NOT extend
 * `aiCall` to carry tool_use semantics. Keeping the boundary clean
 * preserves the LLMClient adapter abstraction.
 *
 * Behaviour preservation contract: drop-in replacement for the
 * pre-multi-provider `streamCompletion(options)` from
 * `src/features/ai-chat/api/anthropicClient.ts` (deleted in the
 * same commit). Same callback shape (`onToken` / `onComplete` /
 * `onError`), same `ChatError` kinds, same silent-abort semantics
 * (no `onError` or `onComplete` after AbortSignal fires). The four
 * existing UI consumers (`useChat`, `requestCleanup`,
 * `ImportCleanupScreen`, etc.) keep rendering errors via
 * `errorMessageFor(t, error)` without modification because the
 * error shape is preserved.
 */
export interface AiStreamOptions {
  /**
   * Active provider config (read by the caller via `readAIConfig`
   * or supplied directly by tests). The function does not touch
   * Dexie or the keystore; passing the config keeps the helper
   * pure and easy to mock.
   */
  config: AIProviderConfig;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Defaults to 4096. Raise only if conversations need longer replies. */
  maxTokens?: number;
  /** AbortSignal-triggered cancellation. Silent: no callbacks fire on abort. */
  signal?: AbortSignal;
  /** Fires for every text delta received via the SSE stream. */
  onToken: (token: string) => void;
  /** Fires exactly once when the stream ends cleanly (provider's done event or EOF). */
  onComplete: (fullText: string) => void;
  /** Fires at most once when the call fails before or during streaming. */
  onError: (error: ChatError) => void;
}

const DEFAULT_MAX_TOKENS = 4096;

/**
 * Resolve the model the caller should use. `config.model` wins;
 * otherwise the active provider's preset default. Anthropic falls
 * back to `DEFAULT_ANTHROPIC_MODEL` to preserve the historical
 * behaviour of the pre-multi-provider code path.
 */
function resolveModel(config: AIProviderConfig): string {
  if (config.model) return config.model;
  if (config.provider === 'anthropic') return DEFAULT_ANTHROPIC_MODEL;
  const preset = getProviderPreset(config.provider);
  return preset?.defaultModel ?? '';
}

/**
 * Resolve the base URL the caller should use. `config.baseUrl` wins
 * (set when the user customised the endpoint via the wizard or via
 * a custom provider); otherwise the preset's canonical URL.
 */
function resolveBaseUrl(config: AIProviderConfig): string {
  if (config.baseUrl) return config.baseUrl;
  const preset = getProviderPreset(config.provider);
  return preset?.baseUrl ?? '';
}

/**
 * Translate a thrown value from `LLMClient.stream()` into the
 * ChatError shape that existing UI consumers already render. Maps
 * the LLMError status codes:
 *   - 'auth_error'    -> { kind: 'auth' }
 *   - 'rate_limited'  -> { kind: 'rate-limit' }
 *   - 'server_error'  -> { kind: 'server' }
 *   - 'offline'       -> { kind: 'network' }
 *   - everything else -> { kind: 'unknown', message }
 *
 * Non-LLMError values fall through to `{ kind: 'unknown' }` with
 * the stringified message.
 */
function mapLLMErrorToChatError(err: unknown): ChatError {
  if (err instanceof LLMError) {
    if (err.status === 'auth_error') return { kind: 'auth' };
    if (err.status === 'rate_limited') return { kind: 'rate-limit' };
    if (err.status === 'server_error') return { kind: 'server' };
    if (err.status === 'offline') return { kind: 'network' };
    return { kind: 'unknown', message: err.detail || err.status };
  }
  return {
    kind: 'unknown',
    message: err instanceof Error ? err.message : String(err),
  };
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Streaming text helper. Drives `LLMClient.stream()`, accumulates
 * the full text, and fires the caller's callbacks. See
 * `AiStreamOptions` for the contract.
 *
 * Returns `Promise<void>` that resolves once the stream finishes
 * (clean done OR error path). The caller is expected to do its UI
 * work inside the callbacks; the resolved Promise is just a
 * lifecycle signal.
 */
export async function aiStream(opts: AiStreamOptions): Promise<void> {
  const client = new LLMClient({
    baseUrl: resolveBaseUrl(opts.config),
    model: resolveModel(opts.config),
    apiKey: opts.config.apiKey,
    temperature: 0,
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    provider: opts.config.provider satisfies AIProvider,
  });

  let fullText = '';
  try {
    for await (const chunk of client.stream(
      [{ role: 'system' as const, content: opts.system }, ...opts.messages],
      { signal: opts.signal },
    )) {
      if (chunk.done) {
        opts.onComplete(fullText);
        return;
      }
      if (chunk.delta) {
        fullText += chunk.delta;
        opts.onToken(chunk.delta);
      }
    }
    // Stream ended without an explicit done event. Surface what we
    // accumulated so the UI exits the streaming state.
    opts.onComplete(fullText);
  } catch (err) {
    if (isAbortError(err)) return;
    opts.onError(mapLLMErrorToChatError(err));
  }
}
