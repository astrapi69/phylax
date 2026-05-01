import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../crypto';
import { setupCompletedOnboarding } from './test-helpers';
import { readMeta } from './meta';
import {
  readAIConfig,
  readMultiAIConfig,
  saveAIConfig,
  saveMultiAIConfig,
  deleteAIConfig,
  type AIProviderConfig,
  type MultiProviderAIConfig,
} from './aiConfig';
import { decryptWithStoredKey } from '../crypto';
import { decodeMetaPayload } from './settings';

const TEST_PASSWORD = 'test-password-12';

async function unlockForTest(): Promise<void> {
  const meta = await readMeta();
  if (!meta) throw new Error('meta row missing');
  await unlock(TEST_PASSWORD, new Uint8Array(meta.salt));
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockForTest();
});

describe('aiConfig persistence', () => {
  it('round-trips a saved config', async () => {
    const config: AIProviderConfig = {
      provider: 'anthropic',
      apiKey: 'sk-ant-xyz',
      model: 'claude-sonnet-4-6',
    };

    await saveAIConfig(config);
    const loaded = await readAIConfig();

    expect(loaded).toEqual(config);
  });

  it('returns null when no config has been saved', async () => {
    const loaded = await readAIConfig();
    expect(loaded).toBeNull();
  });

  it('returns null when the meta row is missing', async () => {
    // Simulate "meta row missing" by deleting it.
    const { db } = await import('./schema');
    await db.meta.clear();

    const loaded = await readAIConfig();
    expect(loaded).toBeNull();
  });

  it('delete removes the config', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-xyz' });
    await deleteAIConfig();

    const loaded = await readAIConfig();
    expect(loaded).toBeNull();
  });

  it('delete is a no-op when nothing is stored', async () => {
    await expect(deleteAIConfig()).resolves.toBeUndefined();

    const loaded = await readAIConfig();
    expect(loaded).toBeNull();
  });

  it('save preserves other MetaPayload fields (autoLockMinutes unchanged)', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-xyz' });

    const meta = await readMeta();
    if (!meta) throw new Error('expected meta row to exist');
    const decrypted = await decryptWithStoredKey(new Uint8Array(meta.payload));
    const payload = decodeMetaPayload(decrypted);

    expect(payload.settings.autoLockMinutes).toBe(5);
    expect(payload.verificationToken).toBe('phylax-verification-v1');
  });

  it('save throws when meta row is missing', async () => {
    const { db } = await import('./schema');
    await db.meta.clear();

    await expect(saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-xyz' })).rejects.toThrow(
      /meta row missing/,
    );
  });

  it('save then overwrite with a different config replaces cleanly', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-first' });
    await saveAIConfig({
      provider: 'anthropic',
      apiKey: 'sk-ant-second',
      model: 'claude-haiku-4-5-20251001',
    });

    const loaded = await readAIConfig();
    expect(loaded?.apiKey).toBe('sk-ant-second');
    expect(loaded?.model).toBe('claude-haiku-4-5-20251001');
  });

  it('saved ciphertext does not contain the apiKey in plaintext', async () => {
    const apiKey = 'sk-ant-super-secret-dont-leak-this';
    await saveAIConfig({ provider: 'anthropic', apiKey });

    const meta = await readMeta();
    if (!meta) throw new Error('expected meta row to exist');
    const bytes = new Uint8Array(meta.payload);
    const asText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    expect(asText).not.toContain(apiKey);
  });
});

describe('multi-provider aiConfig persistence (AI Commit 2)', () => {
  it('readMultiAIConfig returns null when nothing is saved', async () => {
    expect(await readMultiAIConfig()).toBeNull();
  });

  it('legacy saveAIConfig stores a one-element multi shape, readMultiAIConfig returns it', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-x', model: 'claude-sonnet-4-6' });

    const multi = await readMultiAIConfig();
    expect(multi).toEqual({
      providers: [{ provider: 'anthropic', apiKey: 'sk-ant-x', model: 'claude-sonnet-4-6' }],
      activeProviderId: 'anthropic',
    });
  });

  it('legacy saveAIConfig upserts an entry when a different provider is added later', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-x' });
    await saveAIConfig({ provider: 'google', apiKey: 'gsk-y', model: 'gemini-2.0-flash' });

    const multi = await readMultiAIConfig();
    expect(multi?.providers).toHaveLength(2);
    expect(multi?.providers.map((p) => p.provider).sort()).toEqual(['anthropic', 'google']);
    // Most recent legacy save becomes the active provider.
    expect(multi?.activeProviderId).toBe('google');
  });

  it('legacy saveAIConfig replaces an existing entry for the same provider id', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'old-key' });
    await saveAIConfig({
      provider: 'anthropic',
      apiKey: 'new-key',
      model: 'claude-haiku-4-5-20251001',
    });

    const multi = await readMultiAIConfig();
    expect(multi?.providers).toHaveLength(1);
    expect(multi?.providers[0]?.apiKey).toBe('new-key');
    expect(multi?.providers[0]?.model).toBe('claude-haiku-4-5-20251001');
  });

  it('legacy readAIConfig returns the active provider after a multi save', async () => {
    const multi: MultiProviderAIConfig = {
      providers: [
        { provider: 'anthropic', apiKey: 'sk-ant' },
        { provider: 'google', apiKey: 'gsk' },
      ],
      activeProviderId: 'google',
    };
    await saveMultiAIConfig(multi);

    const single = await readAIConfig();
    expect(single?.provider).toBe('google');
    expect(single?.apiKey).toBe('gsk');
  });

  it('saveMultiAIConfig persists the full provider list + active id', async () => {
    const multi: MultiProviderAIConfig = {
      providers: [
        { provider: 'anthropic', apiKey: 'sk-ant', model: 'claude-sonnet-4-6' },
        { provider: 'google', apiKey: 'gsk', model: 'gemini-2.0-flash' },
        { provider: 'lmstudio', apiKey: '' },
      ],
      activeProviderId: 'anthropic',
    };
    await saveMultiAIConfig(multi);

    const loaded = await readMultiAIConfig();
    expect(loaded).toEqual(multi);
  });

  it('saveMultiAIConfig rejects an empty providers list', async () => {
    await expect(
      saveMultiAIConfig({ providers: [], activeProviderId: 'anthropic' }),
    ).rejects.toThrow(/empty/i);
  });

  it('deleteAIConfig clears the entire multi-provider list', async () => {
    await saveMultiAIConfig({
      providers: [
        { provider: 'anthropic', apiKey: 'sk-ant' },
        { provider: 'google', apiKey: 'gsk' },
      ],
      activeProviderId: 'anthropic',
    });
    await deleteAIConfig();

    expect(await readMultiAIConfig()).toBeNull();
    expect(await readAIConfig()).toBeNull();
  });

  it('saved multi ciphertext leaks no plaintext for any provider key', async () => {
    const anthropicKey = 'sk-ant-multi-leak-test-1';
    const googleKey = 'gsk-multi-leak-test-2';
    await saveMultiAIConfig({
      providers: [
        { provider: 'anthropic', apiKey: anthropicKey },
        { provider: 'google', apiKey: googleKey },
      ],
      activeProviderId: 'anthropic',
    });

    const meta = await readMeta();
    if (!meta) throw new Error('expected meta row to exist');
    const bytes = new Uint8Array(meta.payload);
    const asText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    expect(asText).not.toContain(anthropicKey);
    expect(asText).not.toContain(googleKey);
  });
});
