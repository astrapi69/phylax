import { useCallback, useEffect, useState } from 'react';
import { readAIConfig, saveAIConfig, deleteAIConfig } from '../../db/aiConfig';
import type { AIProviderConfig } from '../../db/aiConfig';
import {
  isDisclaimerAccepted,
  setDisclaimerAccepted,
  clearDisclaimerAccepted,
} from './disclaimerStorage';
import type { AIConfigState, KeyFormatWarning } from './types';

// BUG-07 follow-up: each `useAIConfig()` instance maintains its own
// `state`, so the NavBar / NavDrawer copies never noticed when
// AISettingsSection wrote a new key (or deleted the old one) - the
// chat link stayed hidden until a full reload re-ran the load
// effect. Wire a module-level subscription bus: every save / delete
// notifies the bus, every hook instance subscribes and refetches.
// Mirrors the `onLockStateChange` pattern in `src/crypto/keyStore.ts`.
type ConfigChangeListener = () => void;
const configChangeListeners = new Set<ConfigChangeListener>();

function notifyConfigChange(): void {
  for (const listener of configChangeListeners) {
    try {
      listener();
    } catch (err) {
      console.error('[useAIConfig] config-change listener threw:', err);
    }
  }
}

function onAIConfigChange(listener: ConfigChangeListener): () => void {
  configChangeListeners.add(listener);
  return () => {
    configChangeListeners.delete(listener);
  };
}

export interface UseAIConfigResult {
  state: AIConfigState;
  saveConfig: (config: AIProviderConfig) => Promise<void>;
  deleteConfig: () => Promise<void>;
  acceptDisclaimer: () => void;
  resetDisclaimer: () => void;
  /** Pure heuristic: flags non-standard Anthropic key formats. Never blocks. */
  checkKeyFormat: (apiKey: string) => KeyFormatWarning;
}

const ANTHROPIC_KEY_PREFIX = 'sk-ant-';
const MIN_REASONABLE_KEY_LENGTH = 20;

/**
 * Hook that manages the AI configuration lifecycle.
 *
 * Responsibilities:
 * - Load the stored config on mount (requires an unlocked key store)
 * - Save and delete the encrypted config
 * - Track whether the disclaimer has been accepted (localStorage-backed)
 *
 * This hook does NOT make any API calls. Actual AI communication arrives
 * in AI-03 and later.
 */
export function useAIConfig(): UseAIConfigResult {
  const [state, setState] = useState<AIConfigState>({
    status: 'loading',
    disclaimerAccepted: isDisclaimerAccepted(),
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const config = await readAIConfig();
        if (cancelled) return;
        setState({
          status: config ? 'configured' : 'unconfigured',
          config: config ?? undefined,
          disclaimerAccepted: isDisclaimerAccepted(),
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          disclaimerAccepted: isDisclaimerAccepted(),
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    void load();

    // Subscribe to cross-instance config changes so NavBar /
    // NavDrawer / useChat / ImportCleanupScreen all reflect a save
    // or delete that originated in AISettingsSection.
    const unsubscribe = onAIConfigChange(() => {
      if (cancelled) return;
      void load();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const saveConfig = useCallback(async (config: AIProviderConfig) => {
    await saveAIConfig(config);
    setState({
      status: 'configured',
      config,
      disclaimerAccepted: isDisclaimerAccepted(),
    });
    notifyConfigChange();
  }, []);

  const deleteConfig = useCallback(async () => {
    await deleteAIConfig();
    clearDisclaimerAccepted();
    setState({
      status: 'unconfigured',
      disclaimerAccepted: false,
    });
    notifyConfigChange();
  }, []);

  const acceptDisclaimer = useCallback(() => {
    setDisclaimerAccepted();
    setState((prev) => ({ ...prev, disclaimerAccepted: true }));
  }, []);

  const resetDisclaimer = useCallback(() => {
    clearDisclaimerAccepted();
    setState((prev) => ({ ...prev, disclaimerAccepted: false }));
  }, []);

  const checkKeyFormat = useCallback((apiKey: string): KeyFormatWarning => {
    if (!apiKey.startsWith(ANTHROPIC_KEY_PREFIX) || apiKey.length < MIN_REASONABLE_KEY_LENGTH) {
      return 'suspicious';
    }
    return 'ok';
  }, []);

  return {
    state,
    saveConfig,
    deleteConfig,
    acceptDisclaimer,
    resetDisclaimer,
    checkKeyFormat,
  };
}
