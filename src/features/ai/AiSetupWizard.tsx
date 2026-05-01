import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader, useModalTitleId } from '../../ui';
import { saveAIConfig, type AIProvider, type AIProviderConfig } from '../../db/aiConfig';
import { PROVIDER_IDS, PROVIDER_PRESETS, getProviderPreset } from './providers';
import { verifyKey } from './verifyKey';

interface AiSetupWizardProps {
  open: boolean;
  onClose: () => void;
  /**
   * Optional pre-fill. When supplied (e.g., editing an existing
   * provider entry from the Settings list), the wizard mounts with
   * the matching provider preset selected and the fields populated.
   * `provider` defaults to `'anthropic'` for fresh setup.
   */
  initial?: {
    provider?: AIProvider;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
  /**
   * Optional callback fired after a successful save and before
   * `onClose`. Settings integration (Commit 4) wires it so the
   * surrounding state reflects the new active provider without a
   * full reload.
   */
  onSaved?: (config: AIProviderConfig) => void;
}

type TestResult = 'idle' | 'ok' | 'fail';

/**
 * First-run / per-provider AI setup wizard. Three steps:
 *   0. Pick provider preset
 *   1. Enter API key + model + (optional) base URL
 *   2. Test connection (optional but enabled-by-default before
 *      "Finish")
 *
 * Persists via the legacy `saveAIConfig(single)` helper (Commit 2),
 * which performs an upsert against the multi-provider config:
 * existing entries for the same provider id are replaced, new
 * provider ids are appended, the saved provider becomes the active
 * one. The wizard never sees the multi shape directly; the upsert
 * keeps the call site simple.
 *
 * CORS reality is surfaced in two places:
 *   - Provider grid (step 0): the `note` field below the grid
 *     describes the chosen provider's browser-CORS classification.
 *   - Cloud providers with `corsHint: 'blocked'`: a prominent amber
 *     warning surfaces above the API-key field (step 1) explaining
 *     that the configuration can be saved but live calls will fail
 *     until Phylax has a proxy. The wizard does NOT prevent saving
 *     blocked providers; users may want to pre-stage the config for
 *     a future proxy or use it with a personal CORS workaround.
 *
 * Composes the O-20 Modal primitive (focus trap, Escape, backdrop,
 * portal mount, body scroll lock). Default-exported so consumers
 * can wrap the component in `React.lazy()` for code-splitting.
 */
export default function AiSetupWizard({ open, onClose, initial, onSaved }: AiSetupWizardProps) {
  const { t } = useTranslation('ai-config');
  const titleId = useModalTitleId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const initialProvider = initial?.provider ?? 'anthropic';
  const initialPreset = getProviderPreset(initialProvider);
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? initialPreset?.baseUrl ?? '');
  const [model, setModel] = useState(initial?.model ?? initialPreset?.defaultModel ?? '');
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>('idle');
  const [testError, setTestError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const preset = getProviderPreset(provider);
  const needsKey = preset?.requiresApiKey !== false;
  const isCorsBlocked = preset?.corsHint === 'blocked';

  const handleProviderChange = (next: AIProvider) => {
    if (next === provider) return;
    const nextPreset = getProviderPreset(next);
    setProvider(next);
    setBaseUrl(nextPreset?.baseUrl ?? '');
    setModel(nextPreset?.defaultModel ?? '');
    setApiKey('');
    setTestResult('idle');
    setTestError('');
    setSaveError('');
  };

  const buildConfig = (): AIProviderConfig => {
    const cfg: AIProviderConfig = { provider, apiKey };
    if (model) cfg.model = model;
    if (baseUrl) cfg.baseUrl = baseUrl;
    return cfg;
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    setTestError('');
    try {
      const result = await verifyKey({ provider, baseUrl, model, apiKey });
      if (result.ok) {
        setTestResult('ok');
      } else {
        setTestResult('fail');
        setTestError(result.detail || result.status);
      }
    } catch (err) {
      setTestResult('fail');
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const cfg = buildConfig();
      await saveAIConfig(cfg);
      onSaved?.(cfg);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const stepDots = useMemo(() => [0, 1, 2], []);
  const nextDisabled =
    (step === 1 && needsKey && apiKey.trim() === '') || (step === 1 && baseUrl.trim() === '');
  const finishDisabled = saving || (needsKey && apiKey.trim() === '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      role="dialog"
      closeOnEscape={!testing && !saving}
      closeOnBackdropClick={false}
      initialFocusRef={cancelRef}
      size="md"
      testId="ai-setup-wizard"
    >
      <ModalHeader titleId={titleId} titleTestId="ai-setup-wizard-title">
        {t('setup-wizard.title')}
      </ModalHeader>

      <ModalBody>
        <ol aria-label={t('setup-wizard.steps-aria')} className="mb-4 flex items-center gap-2">
          {stepDots.map((s) => (
            <li
              key={s}
              data-testid={`ai-setup-wizard-step-dot-${s}`}
              aria-current={s === step ? 'step' : undefined}
              className={
                s === step
                  ? 'h-2 w-6 rounded-sm bg-blue-600 dark:bg-blue-400'
                  : s < step
                    ? 'h-2 w-6 rounded-sm bg-blue-300 dark:bg-blue-700'
                    : 'h-2 w-6 rounded-sm bg-gray-300 dark:bg-gray-600'
              }
            />
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('setup-wizard.step1.hint')}
            </p>
            <div
              role="radiogroup"
              aria-label={t('setup-wizard.step1.aria-label')}
              className="grid grid-cols-2 gap-2"
            >
              {PROVIDER_IDS.map((pid) => {
                const p = PROVIDER_PRESETS[pid];
                if (!p) return null;
                const selected = provider === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`ai-setup-wizard-provider-${pid}`}
                    onClick={() => handleProviderChange(pid as AIProvider)}
                    className={
                      selected
                        ? 'rounded-sm border-2 border-blue-600 bg-blue-50 px-3 py-2 text-left text-sm font-medium text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'rounded-sm border border-gray-300 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {preset?.note ? (
              <p
                role="note"
                data-testid="ai-setup-wizard-provider-note"
                className="rounded-sm border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
              >
                {preset.note}
              </p>
            ) : null}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {isCorsBlocked && (
              <p
                role="alert"
                data-testid="ai-setup-wizard-cors-warning"
                className="rounded-sm border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
              >
                {t('setup-wizard.cors-blocked-warning')}
              </p>
            )}
            {needsKey ? (
              <div>
                <label
                  htmlFor="ai-setup-wizard-key"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t('setup-wizard.step2.api-key-label')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="ai-setup-wizard-key"
                    name="ai-key"
                    data-testid="ai-setup-wizard-key-input"
                    // BUG-08/09/10 carry-over: browser password
                    // managers (Chrome built-in, 1Password,
                    // LastPass, Bitwarden) treat ANY `type=password`
                    // input as a credentials field and (a) prompt
                    // to save on submit, (b) propose existing
                    // saved credentials on focus, (c) ignore most
                    // autocomplete / data-* opt-out hints.
                    // AISettingsSection's pre-multi-provider form
                    // hit the same wall and resolved it via
                    // type=text + CSS masking; the wizard inherits
                    // the same fix because the wizard now owns
                    // every API-key entry in Phylax.
                    //
                    // Render as `type="text"` always so password
                    // managers never classify the field as
                    // credentials; mask visually via
                    // `-webkit-text-security: disc` when the user
                    // wants the key hidden. Chromium + WebKit
                    // honour the property; Firefox does not (key
                    // renders plaintext when toggle is in
                    // "hidden" mode), accepted trade-off until
                    // Firefox's `-moz-text-security` proposal
                    // lands. The eye-toggle stays the canonical
                    // user gesture.
                    //
                    // Retain the autocomplete + data-* opt-out
                    // stack so heuristic password managers that
                    // scan `type=text` fields (Bitwarden notably)
                    // also skip this input.
                    type="text"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestResult('idle');
                    }}
                    autoComplete="one-time-code"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    spellCheck={false}
                    placeholder={t('setup-wizard.step2.api-key-placeholder')}
                    style={
                      showKey
                        ? undefined
                        : ({
                            WebkitTextSecurity: 'disc',
                            fontFamily: 'monospace',
                          } as React.CSSProperties)
                    }
                    className="flex-1 rounded-sm border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={
                      showKey ? t('setup-wizard.step2.hide-key') : t('setup-wizard.step2.show-key')
                    }
                    data-testid="ai-setup-wizard-key-toggle"
                    className="rounded-sm border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:text-gray-200"
                  >
                    {showKey ? t('setup-wizard.step2.hide-key') : t('setup-wizard.step2.show-key')}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {t('setup-wizard.step2.api-key-hint')}
                </p>
              </div>
            ) : (
              <p
                data-testid="ai-setup-wizard-no-key-hint"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                {t('setup-wizard.step2.no-key-hint')}
              </p>
            )}

            <div>
              <label
                htmlFor="ai-setup-wizard-base-url"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('setup-wizard.step2.base-url-label')}
              </label>
              <input
                id="ai-setup-wizard-base-url"
                data-testid="ai-setup-wizard-base-url-input"
                type="text"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setTestResult('idle');
                }}
                spellCheck={false}
                className="w-full rounded-sm border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="ai-setup-wizard-model"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('setup-wizard.step2.model-label')}
              </label>
              <input
                id="ai-setup-wizard-model"
                data-testid="ai-setup-wizard-model-input"
                type="text"
                list="ai-setup-wizard-model-suggestions"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setTestResult('idle');
                }}
                spellCheck={false}
                placeholder={needsKey ? '' : t('setup-wizard.step2.model-placeholder-local')}
                className="w-full rounded-sm border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <datalist id="ai-setup-wizard-model-suggestions">
                {(preset?.modelSuggestions ?? []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('setup-wizard.step3.hint')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing}
                data-testid="ai-setup-wizard-test-btn"
                className="rounded-sm bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? t('setup-wizard.step3.testing') : t('setup-wizard.step3.test-button')}
              </button>
              {testResult === 'ok' && (
                <span
                  role="status"
                  data-testid="ai-setup-wizard-test-ok"
                  className="text-sm font-medium text-green-700 dark:text-green-300"
                >
                  {t('setup-wizard.step3.ok')}
                </span>
              )}
              {testResult === 'fail' && (
                <span
                  role="alert"
                  data-testid="ai-setup-wizard-test-fail"
                  className="text-sm font-medium text-red-700 dark:text-red-300"
                >
                  {t('setup-wizard.step3.fail', { detail: testError })}
                </span>
              )}
            </div>
            {saveError && (
              <p
                role="alert"
                data-testid="ai-setup-wizard-save-error"
                className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              >
                {saveError}
              </p>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          disabled={testing || saving}
          data-testid="ai-setup-wizard-cancel"
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('setup-wizard.cancel')}
        </button>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={testing || saving}
            data-testid="ai-setup-wizard-back"
            className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('setup-wizard.back')}
          </button>
        )}
        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={nextDisabled}
            data-testid="ai-setup-wizard-next"
            className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('setup-wizard.next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleFinish()}
            disabled={finishDisabled}
            data-testid="ai-setup-wizard-finish"
            className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t('setup-wizard.saving') : t('setup-wizard.finish')}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}

export { AiSetupWizard };
