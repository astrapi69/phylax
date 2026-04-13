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
 * The structured payload stored in meta.payload (encrypted).
 * Contains the verification token and user settings.
 */
export interface MetaPayload {
  verificationToken: string;
  settings: AppSettings;
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
 */
export function encodeMetaPayload(payload: MetaPayload): Uint8Array {
  const sanitized: MetaPayload = {
    verificationToken: payload.verificationToken,
    settings: sanitizeSettings(payload.settings),
  };
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

    const rawSettings = parsed['settings'];
    if (
      typeof rawSettings === 'object' &&
      rawSettings !== null &&
      'autoLockMinutes' in rawSettings
    ) {
      const rawMinutes = (rawSettings as Record<string, unknown>)['autoLockMinutes'];
      if (typeof rawMinutes === 'number' && isValidAutoLockMinutes(rawMinutes)) {
        return {
          verificationToken: token,
          settings: { autoLockMinutes: rawMinutes },
        };
      }
      // Out-of-range value: fall back to default, warn
      console.warn(
        `Auto-lock timeout out of valid range (got ${String(rawMinutes)}), using default.`,
      );
    }

    return {
      verificationToken: token,
      settings: { ...DEFAULT_SETTINGS },
    };
  } catch {
    console.warn('Failed to parse meta payload, using defaults.');
    return {
      verificationToken: VERIFICATION_TOKEN,
      settings: { ...DEFAULT_SETTINGS },
    };
  }
}

function isValidAutoLockMinutes(value: number): boolean {
  return value === 0 || (value >= MIN_AUTO_LOCK_MINUTES && value <= MAX_AUTO_LOCK_MINUTES);
}
