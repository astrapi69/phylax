import { readMeta, writeMeta } from './meta';
import {
  encodeMetaPayload,
  decodeMetaPayload,
  type AppSettings,
  DEFAULT_SETTINGS,
} from './settings';
import { encryptWithStoredKey, decryptWithStoredKey } from '../crypto';

/**
 * Read the persisted AppSettings from the encrypted meta payload.
 *
 * Returns DEFAULT_SETTINGS when the meta row is missing (caller is
 * pre-onboarding / vault is empty). The keystore must be unlocked
 * - `decryptWithStoredKey` throws otherwise; the caller wraps the
 * call in an unlock guard or accepts the throw.
 *
 * Mirrors the read half of `src/db/aiConfig.ts` for consistency.
 * Both functions sit on the same encrypted MetaPayload, so a future
 * generic `readMetaPayload()` helper could replace both - kept
 * separate for now so each lifecycle (settings vs AI config) is
 * easy to read in isolation.
 */
export async function readAppSettings(): Promise<AppSettings> {
  const meta = await readMeta();
  if (!meta) return { ...DEFAULT_SETTINGS };

  const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
  const payload = decodeMetaPayload(decrypted);
  return payload.settings;
}

/**
 * Persist a new AppSettings value, preserving every other field on
 * the encrypted MetaPayload (verification token, AI config). Requires
 * an unlocked keystore and an existing meta row - throws otherwise
 * (mirrors `saveAIConfig` semantics).
 *
 * Settings are clamped to valid ranges by `encodeMetaPayload` /
 * `sanitizeSettings`; callers do not need to pre-validate.
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const meta = await readMeta();
  if (!meta) {
    throw new Error('Cannot save settings: meta row missing. Complete onboarding first.');
  }

  const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
  const payload = decodeMetaPayload(decrypted);
  const next = encodeMetaPayload({ ...payload, settings });
  const encrypted = await encryptWithStoredKey(next);
  await writeMeta(meta.salt, new Uint8Array(encrypted).buffer);
}
