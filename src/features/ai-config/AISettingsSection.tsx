import { useState } from 'react';
import {
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
  type AIProviderConfig,
} from '../../db/aiConfig';
import { useAIConfig } from './useAIConfig';
import { AIDisclaimer } from './AIDisclaimer';

type FormMode = 'idle' | 'entering';

function maskKey(apiKey: string): string {
  const tail = apiKey.slice(-4);
  return `sk-ant-...${tail}`;
}

/**
 * Settings UI for the AI assistant. Three states:
 * - loading: brief placeholder
 * - unconfigured: provider + key input + activate button (routes through disclaimer)
 * - configured: masked key, model dropdown, change and disable actions
 *
 * The API key is never re-displayed after it is saved: the UI shows only a
 * masked preview. Editing the key requires entering a new value.
 */
export function AISettingsSection() {
  const { state, saveConfig, deleteConfig, acceptDisclaimer } = useAIConfig();

  const [mode, setMode] = useState<FormMode>('idle');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState(DEFAULT_ANTHROPIC_MODEL);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pending, setPending] = useState<AIProviderConfig | null>(null);

  const status = state.status;
  const suspicious =
    apiKeyInput.length > 0 && (!apiKeyInput.startsWith('sk-ant-') || apiKeyInput.length < 20);

  function prepareConfig(): AIProviderConfig {
    return {
      provider: 'anthropic',
      apiKey: apiKeyInput,
      model: modelInput,
    };
  }

  async function handleActivate() {
    if (apiKeyInput.length === 0) return;
    const config = prepareConfig();
    if (state.disclaimerAccepted) {
      await saveConfig(config);
      setApiKeyInput('');
      setMode('idle');
    } else {
      setPending(config);
      setShowDisclaimer(true);
    }
  }

  async function handleDisclaimerConfirm() {
    if (!pending) return;
    acceptDisclaimer();
    await saveConfig(pending);
    setApiKeyInput('');
    setPending(null);
    setShowDisclaimer(false);
    setMode('idle');
  }

  function handleDisclaimerCancel() {
    setPending(null);
    setShowDisclaimer(false);
  }

  async function handleDelete() {
    await deleteConfig();
    setMode('idle');
    setApiKeyInput('');
    setModelInput(DEFAULT_ANTHROPIC_MODEL);
  }

  function handleChangeKey() {
    setApiKeyInput('');
    setMode('entering');
  }

  return (
    <section aria-labelledby="ai-settings-heading">
      <h2
        id="ai-settings-heading"
        className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        KI-Assistent
      </h2>

      {status === 'loading' && (
        <p className="text-sm text-gray-600 dark:text-gray-400">Lade KI-Einstellungen...</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-red-700 dark:text-red-300">
          KI-Einstellungen konnten nicht geladen werden.
        </p>
      )}

      {status === 'unconfigured' && (
        <UnconfiguredForm
          apiKey={apiKeyInput}
          onApiKeyChange={setApiKeyInput}
          suspicious={suspicious}
          onActivate={handleActivate}
        />
      )}

      {status === 'configured' && state.config && (
        <ConfiguredFormWrapper
          config={state.config}
          modelInput={modelInput || state.config.model || DEFAULT_ANTHROPIC_MODEL}
          setModelInput={setModelInput}
          saveConfig={saveConfig}
          isEntering={mode === 'entering'}
          newKey={apiKeyInput}
          onNewKeyChange={setApiKeyInput}
          suspicious={suspicious}
          onChangeKey={handleChangeKey}
          onKeySaved={() => {
            setApiKeyInput('');
            setMode('idle');
          }}
          onDelete={handleDelete}
        />
      )}

      {showDisclaimer && (
        <AIDisclaimer
          onConfirm={() => {
            void handleDisclaimerConfirm();
          }}
          onCancel={handleDisclaimerCancel}
        />
      )}
    </section>
  );
}

interface UnconfiguredFormProps {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  suspicious: boolean;
  onActivate: () => void;
}

function UnconfiguredForm({
  apiKey,
  onApiKeyChange,
  suspicious,
  onActivate,
}: UnconfiguredFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <span aria-hidden>○</span> Status: Nicht aktiv
      </p>

      <ProviderSelect />

      <div>
        <label
          htmlFor="ai-api-key"
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          API-Schluessel
        </label>
        <input
          id="ai-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        {suspicious && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="alert">
            Schluesselformat sieht ungewoehnlich aus. Bitte pruefen.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onActivate}
        disabled={apiKey.length === 0}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
      >
        KI aktivieren
      </button>
    </div>
  );
}

interface ConfiguredFormWrapperProps {
  config: AIProviderConfig;
  modelInput: string;
  setModelInput: (model: string) => void;
  saveConfig: (config: AIProviderConfig) => Promise<void>;
  isEntering: boolean;
  newKey: string;
  onNewKeyChange: (value: string) => void;
  suspicious: boolean;
  onChangeKey: () => void;
  onKeySaved: () => void;
  onDelete: () => Promise<void>;
}

/**
 * Wraps ConfiguredForm so the inner closures can reference the narrowed
 * AIProviderConfig without non-null assertions on the parent state.
 */
function ConfiguredFormWrapper({
  config,
  modelInput,
  setModelInput,
  saveConfig,
  isEntering,
  newKey,
  onNewKeyChange,
  suspicious,
  onChangeKey,
  onKeySaved,
  onDelete,
}: ConfiguredFormWrapperProps) {
  async function onModelChange(model: string) {
    setModelInput(model);
    await saveConfig({ ...config, model });
  }

  async function onSaveNewKey() {
    if (newKey.length === 0) return;
    await saveConfig({ ...config, apiKey: newKey });
    onKeySaved();
  }

  function onCancelChangeKey() {
    onKeySaved();
  }

  return (
    <ConfiguredForm
      config={config}
      modelInput={modelInput}
      onModelChange={onModelChange}
      isEntering={isEntering}
      newKey={newKey}
      onNewKeyChange={onNewKeyChange}
      suspicious={suspicious}
      onChangeKey={onChangeKey}
      onSaveNewKey={onSaveNewKey}
      onCancelChangeKey={onCancelChangeKey}
      onDelete={onDelete}
    />
  );
}

interface ConfiguredFormProps {
  config: AIProviderConfig;
  modelInput: string;
  onModelChange: (model: string) => void | Promise<void>;
  isEntering: boolean;
  newKey: string;
  onNewKeyChange: (value: string) => void;
  suspicious: boolean;
  onChangeKey: () => void;
  onSaveNewKey: () => Promise<void>;
  onCancelChangeKey: () => void;
  onDelete: () => Promise<void>;
}

function ConfiguredForm({
  config,
  modelInput,
  onModelChange,
  isEntering,
  newKey,
  onNewKeyChange,
  suspicious,
  onChangeKey,
  onSaveNewKey,
  onCancelChangeKey,
  onDelete,
}: ConfiguredFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-green-700 dark:text-green-400">
        <span aria-hidden>✓</span> Status: Konfiguriert
      </p>

      <ProviderSelect />

      <div>
        <label
          htmlFor="ai-api-key-masked"
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          API-Schluessel
        </label>
        {isEntering ? (
          <div className="space-y-2">
            <input
              id="ai-api-key-masked"
              type="password"
              value={newKey}
              onChange={(e) => onNewKeyChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            {suspicious && (
              <p className="text-xs text-amber-700 dark:text-amber-400" role="alert">
                Schluesselformat sieht ungewoehnlich aus. Bitte pruefen.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void onSaveNewKey()}
                disabled={newKey.length === 0}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={onCancelChangeKey}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <code
              id="ai-api-key-masked"
              data-testid="ai-api-key-masked"
              className="flex-1 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {maskKey(config.apiKey)}
            </code>
            <button
              type="button"
              onClick={onChangeKey}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Aendern
            </button>
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="ai-model"
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Modell
        </label>
        <select
          id="ai-model"
          value={ANTHROPIC_MODELS.includes(modelInput) ? modelInput : ''}
          onChange={(e) => void onModelChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {!ANTHROPIC_MODELS.includes(modelInput) && modelInput && (
            <option value="">{modelInput} (benutzerdefiniert)</option>
          )}
          {ANTHROPIC_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => void onDelete()}
        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
      >
        KI deaktivieren
      </button>
    </div>
  );
}

function ProviderSelect() {
  return (
    <div>
      <label
        htmlFor="ai-provider"
        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Anbieter
      </label>
      <select
        id="ai-provider"
        value="anthropic"
        onChange={() => {
          /* Only Anthropic is supported in this task. */
        }}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="anthropic">Anthropic</option>
      </select>
    </div>
  );
}
