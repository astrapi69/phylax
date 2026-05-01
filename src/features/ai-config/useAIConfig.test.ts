import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import * as aiConfigDb from '../../db/aiConfig';
import type { AIProviderConfig } from '../../db/aiConfig';
import { useAIConfig } from './useAIConfig';
import { DISCLAIMER_STORAGE_KEY } from './disclaimerStorage';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  window.localStorage.clear();
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAIConfig', () => {
  it('initial status is loading, resolves to unconfigured when no key stored', async () => {
    const { result } = renderHook(() => useAIConfig());

    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('unconfigured'));
    expect(result.current.state.config).toBeUndefined();
  });

  it('resolves to configured when a key is already stored', async () => {
    await aiConfigDb.saveAIConfig({
      provider: 'anthropic',
      apiKey: 'sk-ant-stored',
      model: 'claude-sonnet-4-6',
    });

    const { result } = renderHook(() => useAIConfig());

    await waitFor(() => expect(result.current.state.status).toBe('configured'));
    expect(result.current.state.config?.apiKey).toBe('sk-ant-stored');
    expect(result.current.state.config?.model).toBe('claude-sonnet-4-6');
  });

  it('saveConfig transitions to configured and persists', async () => {
    const { result } = renderHook(() => useAIConfig());
    await waitFor(() => expect(result.current.state.status).toBe('unconfigured'));

    const config: AIProviderConfig = { provider: 'anthropic', apiKey: 'sk-ant-new' };
    await act(async () => {
      await result.current.saveConfig(config);
    });

    expect(result.current.state.status).toBe('configured');
    expect(result.current.state.config?.apiKey).toBe('sk-ant-new');
    const stored = await aiConfigDb.readAIConfig();
    expect(stored?.apiKey).toBe('sk-ant-new');
  });

  it('deleteConfig transitions to unconfigured and resets disclaimer', async () => {
    await aiConfigDb.saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-x' });
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');

    const { result } = renderHook(() => useAIConfig());
    await waitFor(() => expect(result.current.state.status).toBe('configured'));

    await act(async () => {
      await result.current.deleteConfig();
    });

    expect(result.current.state.status).toBe('unconfigured');
    expect(result.current.state.disclaimerAccepted).toBe(false);
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBeNull();
    expect(await aiConfigDb.readAIConfig()).toBeNull();
  });

  it('acceptDisclaimer sets the flag in state and localStorage', async () => {
    const { result } = renderHook(() => useAIConfig());
    await waitFor(() => expect(result.current.state.status).toBe('unconfigured'));

    act(() => {
      result.current.acceptDisclaimer();
    });

    expect(result.current.state.disclaimerAccepted).toBe(true);
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBe('true');
  });

  it('resetDisclaimer clears the flag', async () => {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
    const { result } = renderHook(() => useAIConfig());
    await waitFor(() => expect(result.current.state.disclaimerAccepted).toBe(true));

    act(() => {
      result.current.resetDisclaimer();
    });

    expect(result.current.state.disclaimerAccepted).toBe(false);
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBeNull();
  });

  it('transitions to error status when readAIConfig throws', async () => {
    vi.spyOn(aiConfigDb, 'readAIConfig').mockRejectedValueOnce(new Error('locked'));

    const { result } = renderHook(() => useAIConfig());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.errorMessage).toBe('locked');
  });

  it('checkKeyFormat flags non-standard keys as suspicious', async () => {
    const { result } = renderHook(() => useAIConfig());
    await waitFor(() => expect(result.current.state.status).toBe('unconfigured'));

    expect(result.current.checkKeyFormat('sk-ant-abcdefghijklmnop1234')).toBe('ok');
    expect(result.current.checkKeyFormat('sk-proj-xyz')).toBe('suspicious');
    expect(result.current.checkKeyFormat('sk-ant-short')).toBe('suspicious');
    expect(result.current.checkKeyFormat('')).toBe('suspicious');
  });

  it('cross-instance sync: saveConfig propagates to sibling instances (BUG-07 follow-up)', async () => {
    // Two hook instances render independently (e.g., NavBar +
    // AISettingsSection). When AISettingsSection saves a config,
    // NavBar's instance must observe the change without a reload
    // because the chat-link nav gate depends on `state.status`.
    const a = renderHook(() => useAIConfig());
    const b = renderHook(() => useAIConfig());
    await waitFor(() => expect(a.result.current.state.status).toBe('unconfigured'));
    await waitFor(() => expect(b.result.current.state.status).toBe('unconfigured'));

    // Mock the DB read so the listener-driven refetch in instance B
    // sees the saved value.
    vi.spyOn(aiConfigDb, 'readAIConfig').mockResolvedValue({
      provider: 'anthropic',
      apiKey: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      model: 'claude-sonnet-4-5-20250929',
    });

    await act(async () => {
      await a.result.current.saveConfig({
        provider: 'anthropic',
        apiKey: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        model: 'claude-sonnet-4-5-20250929',
      });
    });

    await waitFor(() => expect(a.result.current.state.status).toBe('configured'));
    await waitFor(() => expect(b.result.current.state.status).toBe('configured'));
  });

  it('cross-instance sync: deleteConfig propagates to sibling instances (BUG-07 follow-up)', async () => {
    vi.spyOn(aiConfigDb, 'readAIConfig').mockResolvedValue({
      provider: 'anthropic',
      apiKey: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      model: 'claude-sonnet-4-5-20250929',
    });
    const a = renderHook(() => useAIConfig());
    const b = renderHook(() => useAIConfig());
    await waitFor(() => expect(a.result.current.state.status).toBe('configured'));
    await waitFor(() => expect(b.result.current.state.status).toBe('configured'));

    // Switch the spy back so instance B's listener-driven refetch
    // lands on the empty path.
    vi.spyOn(aiConfigDb, 'readAIConfig').mockResolvedValue(null);

    await act(async () => {
      await a.result.current.deleteConfig();
    });

    await waitFor(() => expect(a.result.current.state.status).toBe('unconfigured'));
    await waitFor(() => expect(b.result.current.state.status).toBe('unconfigured'));
  });
});
