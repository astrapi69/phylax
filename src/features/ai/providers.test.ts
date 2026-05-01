import { describe, it, expect } from 'vitest';
import { PROVIDER_IDS, PROVIDER_PRESETS, detectProvider, getProviderPreset } from './providers';

describe('PROVIDER_PRESETS', () => {
  it('exposes the seven seed providers with stable ids', () => {
    expect(PROVIDER_IDS).toEqual([
      'anthropic',
      'openai',
      'google',
      'mistral',
      'lmstudio',
      'ollama',
      'custom',
    ]);
  });

  it('every preset has the required shape', () => {
    for (const id of PROVIDER_IDS) {
      const p = PROVIDER_PRESETS[id];
      expect(p).toBeDefined();
      expect(p?.id).toBe(id);
      expect(typeof p?.label).toBe('string');
      expect(typeof p?.baseUrl).toBe('string');
      expect(typeof p?.defaultModel).toBe('string');
      expect(Array.isArray(p?.modelSuggestions)).toBe(true);
      expect(typeof p?.requiresApiKey).toBe('boolean');
      expect(['ok', 'anthropic-flag', 'blocked', 'local']).toContain(p?.corsHint);
    }
  });

  it('cloud presets carry a CORS-aware note describing browser limits', () => {
    expect(PROVIDER_PRESETS.openai?.corsHint).toBe('blocked');
    expect(PROVIDER_PRESETS.mistral?.corsHint).toBe('blocked');
    expect(PROVIDER_PRESETS.anthropic?.corsHint).toBe('anthropic-flag');
    expect(PROVIDER_PRESETS.google?.corsHint).toBe('ok');
  });

  it('local presets do not require an api key', () => {
    expect(PROVIDER_PRESETS.lmstudio?.requiresApiKey).toBe(false);
    expect(PROVIDER_PRESETS.ollama?.requiresApiKey).toBe(false);
  });

  it('cloud presets all require an api key', () => {
    expect(PROVIDER_PRESETS.anthropic?.requiresApiKey).toBe(true);
    expect(PROVIDER_PRESETS.openai?.requiresApiKey).toBe(true);
    expect(PROVIDER_PRESETS.google?.requiresApiKey).toBe(true);
    expect(PROVIDER_PRESETS.mistral?.requiresApiKey).toBe(true);
  });
});

describe('getProviderPreset', () => {
  it('returns the preset for a known id', () => {
    expect(getProviderPreset('anthropic')?.label).toBe('Anthropic (Claude)');
  });

  it('returns undefined for an unknown id', () => {
    expect(getProviderPreset('not-a-provider')).toBeUndefined();
  });
});

describe('detectProvider', () => {
  it('matches Anthropic by base URL substring', () => {
    expect(detectProvider('https://api.anthropic.com/v1')).toBe('anthropic');
    expect(detectProvider('https://api.anthropic.com/v1/')).toBe('anthropic');
    expect(detectProvider('HTTPS://API.ANTHROPIC.COM/V1')).toBe('anthropic');
  });

  it('matches OpenAI by base URL substring', () => {
    expect(detectProvider('https://api.openai.com/v1')).toBe('openai');
  });

  it('matches Google Gemini OpenAI-compat endpoint', () => {
    expect(detectProvider('https://generativelanguage.googleapis.com/v1beta/openai')).toBe(
      'google',
    );
  });

  it('matches Mistral by base URL substring', () => {
    expect(detectProvider('https://api.mistral.ai/v1')).toBe('mistral');
  });

  it('detects LM Studio via localhost port 1234 (default)', () => {
    expect(detectProvider('http://localhost:1234/v1')).toBe('lmstudio');
    expect(detectProvider('http://127.0.0.1:1234/v1')).toBe('lmstudio');
  });

  it('detects Ollama via localhost port 11434 (default)', () => {
    expect(detectProvider('http://localhost:11434/v1')).toBe('ollama');
    expect(detectProvider('http://127.0.0.1:11434/v1')).toBe('ollama');
  });

  it('falls back to custom for unknown endpoints', () => {
    expect(detectProvider('https://my-private-llm.example.com/v1')).toBe('custom');
    expect(detectProvider('http://localhost:9999/v1')).toBe('custom');
  });

  it('treats trailing slashes as equivalent', () => {
    expect(detectProvider('https://api.anthropic.com/v1/////')).toBe('anthropic');
  });
});
