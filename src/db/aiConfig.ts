import { readMeta, writeMeta } from './meta';
import {
  encodeMetaPayload,
  decodeMetaPayload,
  type AIProviderConfig,
  type MultiProviderAIConfig,
} from './settings';
import { encryptWithStoredKey, decryptWithStoredKey } from '../crypto';

export type { AIProvider, AIProviderConfig, MultiProviderAIConfig } from './settings';

/** Default Anthropic model. Cost-effective default for structured output. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

/**
 * Known Anthropic models surfaced in the model dropdown. Ordered by
 * decreasing capability / increasing cost: Opus for the highest-quality
 * needs, Sonnet as the cost-effective default, Haiku for cheap +
 * fast use cases (e.g. classification short-circuit in IMP-03).
 */
export const ANTHROPIC_MODELS: readonly string[] = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

/**
 * Read the active AI provider's config (legacy single-shape API).
 * Returns null when no AI is configured. Built on top of
 * `readMultiAIConfig`; included so existing single-provider call
 * sites (NavBar / NavDrawer / useChat / requestCompletion) keep
 * working unchanged. New call sites should prefer
 * `readMultiAIConfig` and operate on the full provider list.
 *
 * Migration: a vault saved under the legacy single shape is
 * automatically translated to the multi shape on read by
 * `decodeMetaPayload` (see `parseAIConfig` in `db/settings.ts`),
 * so this helper continues to return the user's existing Anthropic
 * config without any explicit migration call.
 */
export async function readAIConfig(): Promise<AIProviderConfig | null> {
  const multi = await readMultiAIConfig();
  if (!multi) return null;
  const active = multi.providers.find((p) => p.provider === multi.activeProviderId);
  return active ?? multi.providers[0] ?? null;
}

/**
 * Read the full multi-provider config (new API). Returns null when
 * no AI is configured. The returned shape always carries at least
 * one entry and an `activeProviderId` that points at one of them
 * (decoder repairs inconsistent state, see `parseAIConfig`).
 */
export async function readMultiAIConfig(): Promise<MultiProviderAIConfig | null> {
  const meta = await readMeta();
  if (!meta) return null;

  const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
  const payload = decodeMetaPayload(decrypted);
  return payload.aiConfig ?? null;
}

/**
 * Save a single AI provider config (legacy single-shape API).
 * Performs an upsert against the existing multi-config:
 *   - If a provider entry with the same `provider` id exists, it is
 *     replaced with `config`.
 *   - Otherwise `config` is appended.
 *   - The saved provider becomes `activeProviderId`.
 *   - When no multi-config exists yet, a new one is created with
 *     `config` as the sole entry.
 *
 * Preserves all other MetaPayload fields (verification token, app
 * settings). Requires an unlocked key store and an existing meta
 * row (onboarding must have completed).
 */
export async function saveAIConfig(config: AIProviderConfig): Promise<void> {
  const meta = await readMeta();
  if (!meta) {
    throw new Error('Cannot save AI config: meta row missing. Complete onboarding first.');
  }

  const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
  const payload = decodeMetaPayload(decrypted);

  const existing = payload.aiConfig;
  const nextProviders: AIProviderConfig[] = existing ? [...existing.providers] : [];
  const idx = nextProviders.findIndex((p) => p.provider === config.provider);
  if (idx >= 0) {
    nextProviders[idx] = config;
  } else {
    nextProviders.push(config);
  }
  const nextMulti: MultiProviderAIConfig = {
    providers: nextProviders,
    activeProviderId: config.provider,
  };

  const next = encodeMetaPayload({ ...payload, aiConfig: nextMulti });
  const encrypted = await encryptWithStoredKey(next);
  await writeMeta(meta.salt, new Uint8Array(encrypted).buffer);
}

/**
 * Save the full multi-provider config (new API). Used by the
 * AiSetupWizard (Commit 3) when the user reorders / removes
 * providers or switches the active id without changing any single
 * provider's fields.
 *
 * Empty `providers` array is rejected to keep the storage shape
 * meaningful; callers that want to clear the AI config should call
 * `deleteAIConfig` instead. The `activeProviderId` must reference
 * one of the entries; otherwise the encoder logs a warning and the
 * decoder repairs at next read (defence in depth).
 */
export async function saveMultiAIConfig(config: MultiProviderAIConfig): Promise<void> {
  if (config.providers.length === 0) {
    throw new Error(
      'Cannot save empty multi-provider AI config. Use deleteAIConfig() to clear instead.',
    );
  }

  const meta = await readMeta();
  if (!meta) {
    throw new Error('Cannot save AI config: meta row missing. Complete onboarding first.');
  }

  const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
  const payload = decodeMetaPayload(decrypted);
  const next = encodeMetaPayload({ ...payload, aiConfig: config });
  const encrypted = await encryptWithStoredKey(next);
  await writeMeta(meta.salt, new Uint8Array(encrypted).buffer);
}

/**
 * Remove the AI provider config entirely (clears every provider
 * entry). Other MetaPayload fields are preserved. No-op when no
 * config is stored. Requires an unlocked key store.
 */
export async function deleteAIConfig(): Promise<void> {
  const meta = await readMeta();
  if (!meta) return;

  const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
  const payload = decodeMetaPayload(decrypted);
  if (!payload.aiConfig) return;

  // Rebuild without aiConfig. encodeMetaPayload omits the field when it's absent.
  const next = encodeMetaPayload({
    verificationToken: payload.verificationToken,
    settings: payload.settings,
  });
  const encrypted = await encryptWithStoredKey(next);
  await writeMeta(meta.salt, new Uint8Array(encrypted).buffer);
}
