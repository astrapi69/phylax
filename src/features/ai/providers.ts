/**
 * AI provider presets and configuration schema.
 *
 * Each preset defines the base URL, default model, and model
 * suggestions for a supported AI provider. Users can override any
 * value via the multi-provider config dialog.
 *
 * Browser-side note: providers differ in CORS behaviour when called
 * directly from a browser PWA. See `corsHint` per entry. Phylax has
 * no proxy server (local-first model, ADR direct-from-browser keys),
 * so providers with `corsHint: 'blocked'` cannot complete a real
 * request from the running app even when their config is saved. The
 * SetupWizard surfaces this via the per-provider `note` field.
 *
 * Lifted from the Bibliogon donor module on 2026-05-01 per the
 * IM-05-Option-B-style extraction pattern. Phylax-specific changes:
 * single-quote string style and named-export over default-export.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  modelSuggestions: string[];
  requiresApiKey: boolean;
  /**
   * Browser CORS reality check.
   *  - 'ok': works directly from a browser
   *  - 'anthropic-flag': needs the
   *    `anthropic-dangerous-direct-browser-access: true` opt-in header
   *  - 'blocked': provider blocks browser CORS, needs a proxy
   *  - 'local': local server, depends on the user's CORS setup
   */
  corsHint: 'ok' | 'anthropic-flag' | 'blocked' | 'local';
  note?: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    modelSuggestions: [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
    ],
    requiresApiKey: true,
    corsHint: 'anthropic-flag',
    note: 'Requires anthropic-dangerous-direct-browser-access header. Key visible in DevTools Network tab.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT)',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    modelSuggestions: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    requiresApiKey: true,
    corsHint: 'blocked',
    note: 'OpenAI blocks browser CORS. Requires a proxy that Phylax does not currently provide.',
  },
  google: {
    id: 'google',
    label: 'Google (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    modelSuggestions: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    requiresApiKey: true,
    corsHint: 'ok',
    note: 'OpenAI-compatible endpoint, browser CORS works.',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    modelSuggestions: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    requiresApiKey: true,
    corsHint: 'blocked',
    note: 'Mistral blocks browser CORS as of 2026-04. Requires a proxy that Phylax does not currently provide.',
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    modelSuggestions: [],
    requiresApiKey: false,
    corsHint: 'local',
    note: 'Local server. Enable CORS in LM Studio server settings.',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: '',
    modelSuggestions: [],
    requiresApiKey: false,
    corsHint: 'local',
    note: 'Local server. Set OLLAMA_ORIGINS to allow your PWA origin.',
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compat)',
    baseUrl: '',
    defaultModel: '',
    modelSuggestions: [],
    requiresApiKey: true,
    corsHint: 'local',
    note: "User-supplied OpenAI-compatible endpoint. CORS is the user's responsibility.",
  },
};

export const PROVIDER_IDS: readonly string[] = Object.keys(PROVIDER_PRESETS);

export function getProviderPreset(providerId: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS[providerId];
}

/**
 * Best-effort detection of a provider id from a base URL. Used by
 * `LLMClient` to pick the adapter (Anthropic native vs OpenAI-compat)
 * when the caller did not pass an explicit `provider` field.
 *
 *   - Substring match against every preset's `baseUrl` (case-
 *     insensitive, trailing slashes stripped).
 *   - Localhost ports for LM Studio (1234) and Ollama (11434) are
 *     recognised even if the user pointed at a different host.
 *   - Anything else falls back to `'custom'` so the OpenAI-compat
 *     path is taken (the safe default for unknown OpenAI-shape
 *     endpoints).
 */
export function detectProvider(baseUrl: string): string {
  const urlLower = baseUrl.toLowerCase().replace(/\/+$/, '');
  for (const [id, preset] of Object.entries(PROVIDER_PRESETS)) {
    if (id === 'custom') continue;
    const presetUrl = preset.baseUrl.toLowerCase().replace(/\/+$/, '');
    if (presetUrl && urlLower.includes(presetUrl)) return id;
  }
  if (urlLower.includes('localhost:1234') || urlLower.includes('127.0.0.1:1234')) return 'lmstudio';
  if (urlLower.includes('localhost:11434') || urlLower.includes('127.0.0.1:11434')) return 'ollama';
  return 'custom';
}
