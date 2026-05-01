/**
 * Lightweight provider connection test. Returns one of:
 *   'ok' | 'auth_error' | 'rate_limited' | 'offline' | 'timeout'
 *   | 'model_not_found' | 'invalid_request' | 'server_error' | 'error'
 *
 * Anthropic: 1-token /v1/messages call (cheap, exercises auth).
 * OpenAI-compatible: GET /models (cheap, no token cost).
 *
 * Lifted from the Bibliogon donor module on 2026-05-01. The
 * `AiVerifyConfig` shape is local to this module so it can stand
 * alone without depending on the donor's `store.ts` (rejected per
 * the multi-AI-provider integration plan; Phylax stores the AI
 * config under its existing `MetaPayload` blob).
 */

import { LLMClient, LLMError } from './llmClient';

export interface AiVerifyConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface VerifyResult {
  ok: boolean;
  status: string;
  detail: string;
}

export async function verifyKey(config: AiVerifyConfig, timeoutMs = 10_000): Promise<VerifyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (config.provider === 'anthropic') {
      return await verifyAnthropic(config, controller.signal);
    }
    return await verifyOpenAI(config, controller.signal);
  } catch (e) {
    if (e instanceof LLMError) return { ok: false, status: e.status, detail: e.detail };
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, status: 'timeout', detail: 'Request timed out' };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 'error', detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyAnthropic(config: AiVerifyConfig, signal: AbortSignal): Promise<VerifyResult> {
  const client = new LLMClient({
    baseUrl: config.baseUrl,
    model: config.model || 'claude-haiku-4-5-20251001',
    apiKey: config.apiKey,
    temperature: 0,
    maxTokens: 1,
    provider: 'anthropic',
  });
  // 1-token chat is the cheapest auth check Anthropic exposes.
  await client.chat([{ role: 'user', content: 'hi' }], { maxTokens: 1, signal });
  return { ok: true, status: 'ok', detail: '' };
}

async function verifyOpenAI(config: AiVerifyConfig, signal: AbortSignal): Promise<VerifyResult> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/models`, { headers, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // Re-throw so the outer `verifyKey` wrapper classifies as 'timeout'.
      throw e;
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 'offline', detail: msg };
  }
  if (response.ok) return { ok: true, status: 'ok', detail: '' };
  const text = await response.text().catch(() => '');
  let detail = text.slice(0, 200);
  try {
    const parsed = JSON.parse(text);
    detail = parsed.error?.message || parsed.detail || parsed.message || detail;
  } catch {
    // keep raw
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: 'auth_error', detail: detail || 'API key invalid' };
  }
  if (response.status === 429) {
    return { ok: false, status: 'rate_limited', detail: detail || 'Rate limit' };
  }
  if (response.status >= 500) {
    return { ok: false, status: 'server_error', detail: detail || `HTTP ${response.status}` };
  }
  return { ok: false, status: 'error', detail: detail || `HTTP ${response.status}` };
}
