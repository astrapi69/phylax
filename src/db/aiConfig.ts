import { readMeta, writeMeta } from './meta';
import { encodeMetaPayload, decodeMetaPayload, type AIProviderConfig } from './settings';
import { encryptWithStoredKey, decryptWithStoredKey } from '../crypto';

export type { AIProvider, AIProviderConfig } from './settings';

/** Default Anthropic model. Cost-effective default for structured output. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

/** Known Anthropic models surfaced in the model dropdown. */
export const ANTHROPIC_MODELS: readonly string[] = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
];

/**
 * Read the stored AI provider config. Returns null when the user has not
 * configured AI. Requires an unlocked key store.
 */
export async function readAIConfig(): Promise<AIProviderConfig | null> {
  const meta = await readMeta();
  if (!meta) return null;

  const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
  const payload = decodeMetaPayload(decrypted);
  return payload.aiConfig ?? null;
}

/**
 * Save the AI provider config. Preserves all other MetaPayload fields
 * (verification token, app settings). Requires an unlocked key store and
 * an existing meta row (onboarding must have completed).
 */
export async function saveAIConfig(config: AIProviderConfig): Promise<void> {
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
 * Remove the AI provider config. Other MetaPayload fields are preserved.
 * No-op when no config is stored. Requires an unlocked key store.
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
