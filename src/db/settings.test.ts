import { describe, it, expect, vi } from 'vitest';
import {
  encodeMetaPayload,
  decodeMetaPayload,
  DEFAULT_SETTINGS,
  type MetaPayload,
  type AIProviderConfig,
} from './settings';
import { VERIFICATION_TOKEN } from './meta';

describe('MetaPayload encoding/decoding', () => {
  it('round-trips a valid payload', () => {
    const payload: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 10 },
    };

    const encoded = encodeMetaPayload(payload);
    const decoded = decodeMetaPayload(encoded);

    expect(decoded.verificationToken).toBe(VERIFICATION_TOKEN);
    expect(decoded.settings.autoLockMinutes).toBe(10);
  });

  it('handles legacy bare-token format', () => {
    const legacyBytes = new TextEncoder().encode(VERIFICATION_TOKEN);
    const decoded = decodeMetaPayload(legacyBytes);

    expect(decoded.verificationToken).toBe(VERIFICATION_TOKEN);
    expect(decoded.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for malformed JSON', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malformed = new TextEncoder().encode('{not valid json!!!');
    const decoded = decodeMetaPayload(malformed);

    expect(decoded.verificationToken).toBe(VERIFICATION_TOKEN);
    expect(decoded.settings).toEqual(DEFAULT_SETTINGS);
    expect(spy).toHaveBeenCalledOnce();

    spy.mockRestore();
  });

  it('falls back to defaults for out-of-range autoLockMinutes', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const outOfRange: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 999 },
    };
    // Encode bypasses clamp check to simulate corrupted data
    const raw = new TextEncoder().encode(JSON.stringify(outOfRange));
    const decoded = decodeMetaPayload(raw);

    expect(decoded.settings.autoLockMinutes).toBe(DEFAULT_SETTINGS.autoLockMinutes);
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('round-trips autoLockMinutes=0 (disabled)', () => {
    const payload: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 0 },
    };

    const encoded = encodeMetaPayload(payload);
    const decoded = decodeMetaPayload(encoded);

    expect(decoded.settings.autoLockMinutes).toBe(0);
  });

  it('clamps values on write', () => {
    const tooLow: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: -5 },
    };
    const tooHigh: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 120 },
    };

    const decodedLow = decodeMetaPayload(encodeMetaPayload(tooLow));
    const decodedHigh = decodeMetaPayload(encodeMetaPayload(tooHigh));

    expect(decodedLow.settings.autoLockMinutes).toBe(1);
    expect(decodedHigh.settings.autoLockMinutes).toBe(60);
  });

  it('round-trips aiConfig alongside settings', () => {
    const aiConfig: AIProviderConfig = {
      provider: 'anthropic',
      apiKey: 'sk-ant-abc123',
      model: 'claude-sonnet-4-6',
    };
    const payload: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 5 },
      aiConfig,
    };

    const decoded = decodeMetaPayload(encodeMetaPayload(payload));

    expect(decoded.aiConfig).toEqual(aiConfig);
    expect(decoded.settings.autoLockMinutes).toBe(5);
  });

  it('decodes payload without aiConfig as undefined (backward compat)', () => {
    const payload: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 5 },
    };

    const decoded = decodeMetaPayload(encodeMetaPayload(payload));

    expect(decoded.aiConfig).toBeUndefined();
  });

  it('rejects malformed aiConfig (missing apiKey)', () => {
    const raw = JSON.stringify({
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 5 },
      aiConfig: { provider: 'anthropic' },
    });
    const decoded = decodeMetaPayload(new TextEncoder().encode(raw));

    expect(decoded.aiConfig).toBeUndefined();
  });

  it('omits aiConfig from encoded JSON when absent', () => {
    const payload: MetaPayload = {
      verificationToken: VERIFICATION_TOKEN,
      settings: { autoLockMinutes: 5 },
    };

    const encoded = new TextDecoder().decode(encodeMetaPayload(payload));

    expect(encoded).not.toContain('aiConfig');
  });
});
