import { VERIFICATION_TOKEN } from './meta';

/**
 * App-level settings stored in the encrypted meta payload.
 */
export interface AppSettings {
  /** Auto-lock timeout in minutes. 0 = disabled, 1-60 valid range. */
  autoLockMinutes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 5,
};

export const MIN_AUTO_LOCK_MINUTES = 1;
export const MAX_AUTO_LOCK_MINUTES = 60;

/**
 * Known AI providers. Broadened in the AI multi-provider series
 * (commit `ef49c65` introduced the `LLMClient` adapters; this commit
 * extends storage to match). The union mirrors the seven seed
 * providers in `src/features/ai/providers.ts` so the storage layer
 * accepts every preset id without further validation churn.
 */
export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'mistral'
  | 'lmstudio'
  | 'ollama'
  | 'custom';

/**
 * User-supplied configuration for a single AI provider entry.
 * `apiKey` may be empty for local providers (`lmstudio`, `ollama`,
 * `custom`) per the donor preset table; storage accepts the empty
 * string and the runtime adapter omits the Authorization header.
 */
export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  /** Optional model override. Defaults are resolved in the feature layer. */
  model?: string;
  /** Optional base URL for OpenAI-compatible endpoints. */
  baseUrl?: string;
}

/**
 * Multi-provider AI configuration. Replaces the original single
 * `AIProviderConfig` storage shape from the foundation task. The
 * user can register more than one provider (Anthropic + Google +
 * a local model server, etc.) and pick which one is active at any
 * moment. Migration from the single shape is automatic; see
 * `parseAIConfig` for the read-side translation.
 *
 *   - `providers`: ordered list, deduplicated by `provider` id.
 *     Empty array is invalid (the whole `aiConfig` field is then
 *     omitted from the encoded payload).
 *   - `activeProviderId`: must point at one of `providers[*].provider`.
 *     The decoder repairs an inconsistent state by re-pointing at
 *     `providers[0].provider` and logging a warning.
 */
export interface MultiProviderAIConfig {
  providers: AIProviderConfig[];
  activeProviderId: AIProvider;
}

/**
 * The structured payload stored in meta.payload (encrypted).
 * Contains the verification token, user settings, and optional AI
 * configuration. The aiConfig field stores the multi-provider shape;
 * decoding accepts the legacy single shape for back-compat and
 * upgrades it on the next save.
 */
export interface MetaPayload {
  verificationToken: string;
  settings: AppSettings;
  /** Absent when the user has not configured any AI provider. */
  aiConfig?: MultiProviderAIConfig;
}

const KNOWN_AI_PROVIDERS: readonly AIProvider[] = [
  'anthropic',
  'openai',
  'google',
  'mistral',
  'lmstudio',
  'ollama',
  'custom',
];

function isKnownProvider(value: unknown): value is AIProvider {
  return typeof value === 'string' && (KNOWN_AI_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Clamp an auto-lock timeout value to the valid range.
 * 0 is a special value meaning "disabled" and passes through.
 * Values below MIN clamp to MIN, above MAX clamp to MAX.
 */
export function clampAutoLockMinutes(value: number): number {
  if (value === 0) return 0;
  return Math.max(MIN_AUTO_LOCK_MINUTES, Math.min(MAX_AUTO_LOCK_MINUTES, value));
}

/**
 * Validate settings and return a sanitized copy.
 * Clamps auto-lock to valid range on write.
 */
export function sanitizeSettings(settings: AppSettings): AppSettings {
  return {
    autoLockMinutes: clampAutoLockMinutes(settings.autoLockMinutes),
  };
}

/**
 * Encode a MetaPayload to UTF-8 bytes for encryption.
 * Settings are sanitized (clamped) before encoding.
 * aiConfig is included only when present; absence means "not configured".
 */
export function encodeMetaPayload(payload: MetaPayload): Uint8Array {
  const sanitized: MetaPayload = {
    verificationToken: payload.verificationToken,
    settings: sanitizeSettings(payload.settings),
  };
  if (payload.aiConfig) {
    sanitized.aiConfig = payload.aiConfig;
  }
  return new TextEncoder().encode(JSON.stringify(sanitized));
}

/**
 * Decode a MetaPayload from decrypted UTF-8 bytes.
 *
 * Handles backward compatibility:
 * - If the string is valid JSON with the expected shape, parse it.
 * - If the string is the bare verification token (F-12 legacy format),
 *   return it with default settings.
 * - If the JSON is malformed, return with default settings and log a warning.
 *
 * Validates settings on read: out-of-range values fall back to defaults.
 */
export function decodeMetaPayload(bytes: Uint8Array): MetaPayload {
  const text = new TextDecoder().decode(bytes);

  // Legacy format: bare verification token string
  if (!text.startsWith('{')) {
    return {
      verificationToken: text,
      settings: { ...DEFAULT_SETTINGS },
    };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const token =
      typeof parsed['verificationToken'] === 'string'
        ? parsed['verificationToken']
        : VERIFICATION_TOKEN;

    const aiConfig = parseAIConfig(parsed['aiConfig']);

    const rawSettings = parsed['settings'];
    if (
      typeof rawSettings === 'object' &&
      rawSettings !== null &&
      'autoLockMinutes' in rawSettings
    ) {
      const rawMinutes = (rawSettings as Record<string, unknown>)['autoLockMinutes'];
      if (typeof rawMinutes === 'number' && isValidAutoLockMinutes(rawMinutes)) {
        return withAIConfig(
          {
            verificationToken: token,
            settings: { autoLockMinutes: rawMinutes },
          },
          aiConfig,
        );
      }
      // Out-of-range value: fall back to default, warn
      console.warn(
        `Auto-lock timeout out of valid range (got ${String(rawMinutes)}), using default.`,
      );
    }

    return withAIConfig(
      {
        verificationToken: token,
        settings: { ...DEFAULT_SETTINGS },
      },
      aiConfig,
    );
  } catch {
    console.warn('Failed to parse meta payload, using defaults.');
    return {
      verificationToken: VERIFICATION_TOKEN,
      settings: { ...DEFAULT_SETTINGS },
    };
  }
}

function withAIConfig(base: MetaPayload, aiConfig: MultiProviderAIConfig | undefined): MetaPayload {
  return aiConfig ? { ...base, aiConfig } : base;
}

/**
 * Parse a single `AIProviderConfig` entry from raw JSON. Returns
 * undefined when the entry is malformed or carries an empty key for
 * a cloud provider that requires one. Local providers (lmstudio,
 * ollama, custom) accept an empty `apiKey` because their endpoints
 * do not require authentication.
 */
function parseSingleProviderEntry(raw: unknown): AIProviderConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;
  const provider = obj['provider'];
  const apiKey = obj['apiKey'];
  if (!isKnownProvider(provider)) return undefined;
  if (typeof apiKey !== 'string') return undefined;
  const isLocalProvider = provider === 'lmstudio' || provider === 'ollama' || provider === 'custom';
  if (apiKey.length === 0 && !isLocalProvider) return undefined;
  const config: AIProviderConfig = { provider, apiKey };
  if (typeof obj['model'] === 'string' && obj['model'].length > 0) {
    config.model = obj['model'];
  }
  if (typeof obj['baseUrl'] === 'string' && obj['baseUrl'].length > 0) {
    config.baseUrl = obj['baseUrl'];
  }
  return config;
}

/**
 * Parse the `aiConfig` field of a decoded MetaPayload. Accepts both
 * shapes for back-compat:
 *   - Legacy single shape `{ provider, apiKey, model?, baseUrl? }`
 *     (pre-multi-provider; written by the foundation task and any
 *     existing user vault). Migrated in-memory to a one-element
 *     multi shape; the next `saveMultiAIConfig` persists the multi
 *     shape so the migration is one-shot.
 *   - New multi shape
 *     `{ providers: AIProviderConfig[], activeProviderId }` written
 *     by Commit 2 onward.
 *
 * Repairs an inconsistent multi shape by:
 *   - dropping malformed entries
 *   - deduplicating entries by `provider` id (last write wins,
 *     mirrors the upsert semantic of `saveAIConfig` legacy callers)
 *   - re-pointing `activeProviderId` at `providers[0].provider`
 *     when the named id is not present in the list
 *
 * Returns undefined for an empty / fully-malformed multi shape so
 * the encoder omits the field entirely.
 */
function parseAIConfig(raw: unknown): MultiProviderAIConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;

  // New multi shape branch.
  if (Array.isArray(obj['providers'])) {
    const entries: AIProviderConfig[] = [];
    const seen = new Set<AIProvider>();
    for (const entry of obj['providers']) {
      const parsed = parseSingleProviderEntry(entry);
      if (!parsed) continue;
      if (seen.has(parsed.provider)) {
        const idx = entries.findIndex((e) => e.provider === parsed.provider);
        if (idx >= 0) entries[idx] = parsed;
        continue;
      }
      seen.add(parsed.provider);
      entries.push(parsed);
    }
    if (entries.length === 0) return undefined;
    const requestedActive = obj['activeProviderId'];
    const firstEntry = entries[0];
    if (!firstEntry) return undefined;
    let activeProviderId: AIProvider = firstEntry.provider;
    if (isKnownProvider(requestedActive) && seen.has(requestedActive)) {
      activeProviderId = requestedActive;
    } else if (isKnownProvider(requestedActive)) {
      console.warn(
        `[settings] aiConfig.activeProviderId '${requestedActive}' not in providers; falling back to '${activeProviderId}'.`,
      );
    }
    return { providers: entries, activeProviderId };
  }

  // Legacy single shape: migrate in-memory to one-element multi.
  const single = parseSingleProviderEntry(raw);
  if (!single) return undefined;
  return { providers: [single], activeProviderId: single.provider };
}

function isValidAutoLockMinutes(value: number): boolean {
  return value === 0 || (value >= MIN_AUTO_LOCK_MINUTES && value <= MAX_AUTO_LOCK_MINUTES);
}
