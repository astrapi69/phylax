import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../crypto';
import { setupCompletedOnboarding } from './test-helpers';
import { readMeta } from './meta';
import { readAIConfig, saveAIConfig, deleteAIConfig, type AIProviderConfig } from './aiConfig';
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
      model: 'claude-sonnet-4-20250514',
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
