import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../crypto';
import { setupCompletedOnboarding } from './test-helpers';
import { readMeta } from './meta';
import { readAppSettings, saveAppSettings } from './appSettings';
import { DEFAULT_SETTINGS } from './settings';

const TEST_PASSWORD = 'test-password-12';

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
});

describe('readAppSettings', () => {
  it('returns DEFAULT_SETTINGS when meta row is missing', async () => {
    lock();
    // Wipe meta
    const { db } = await import('./schema');
    await db.meta.clear();

    // Without unlock + meta, readAppSettings returns defaults.
    const settings = await readAppSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the persisted settings after a save', async () => {
    await saveAppSettings({ autoLockMinutes: 15 });
    const settings = await readAppSettings();
    expect(settings.autoLockMinutes).toBe(15);
  });

  it('returns DEFAULT_SETTINGS on first read of a fresh meta row', async () => {
    const settings = await readAppSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveAppSettings', () => {
  it('persists autoLockMinutes verbatim within the valid range', async () => {
    await saveAppSettings({ autoLockMinutes: 30 });
    const settings = await readAppSettings();
    expect(settings.autoLockMinutes).toBe(30);
  });

  it('clamps out-of-range values via sanitizeSettings', async () => {
    await saveAppSettings({ autoLockMinutes: 999 });
    const settings = await readAppSettings();
    expect(settings.autoLockMinutes).toBe(60);
  });

  it('preserves AI config across a settings save', async () => {
    const { saveAIConfig, readAIConfig } = await import('./aiConfig');
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test' });
    await saveAppSettings({ autoLockMinutes: 10 });
    const ai = await readAIConfig();
    expect(ai?.apiKey).toBe('sk-ant-test');
  });

  it('throws when the meta row is missing', async () => {
    const { db } = await import('./schema');
    await db.meta.clear();
    await expect(saveAppSettings({ autoLockMinutes: 10 })).rejects.toThrow(/meta row missing/);
  });
});
