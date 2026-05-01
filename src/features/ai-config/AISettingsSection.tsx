import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig } from '../../db/aiConfig';
import { getProviderPreset } from '../ai/providers';
import { useAIConfig } from './useAIConfig';
import { AIDisclaimer } from './AIDisclaimer';
import { PrivacyInfoPopover } from './PrivacyInfoPopover';

// Lazy-loaded wizard. Pulls the wizard module only when the user
// clicks "AI aktivieren" or "Anbieter verwalten"; the Settings
// screen never bundles the wizard chrome at first paint.
const AiSetupWizard = lazy(() => import('../ai/AiSetupWizard'));

function maskKey(provider: string, apiKey: string): string {
  if (apiKey.length === 0) return '';
  const tail = apiKey.slice(-4);
  if (provider === 'anthropic') return `sk-ant-...${tail}`;
  if (apiKey.startsWith('sk-')) return `sk-...${tail}`;
  return `...${tail}`;
}

/**
 * Settings UI for the AI assistant after the multi-provider rewrite
 * (AI Commit 4b). The inline forms from the foundation task are
 * gone; provider creation + editing now happens in the lazy-loaded
 * `AiSetupWizard`.
 *
 * States:
 *   - loading / error: brief placeholder.
 *   - unconfigured: "AI aktivieren" button. First click routes
 *     through the AIDisclaimer (one-shot per vault) before the
 *     wizard opens. Returning users with the disclaimer already
 *     accepted skip straight to the wizard.
 *   - configured: summary card showing the active provider's
 *     label, masked API key, and model. Two actions:
 *       * "Anbieter verwalten" -> opens the wizard pre-filled
 *         with the active provider's fields for editing
 *       * "KI deaktivieren" -> calls `deleteConfig()` to clear
 *         the entire multi-provider list
 *
 * Existing single-shape Anthropic users hit the configured branch
 * via `useAIConfig` -> `readAIConfig()`, which derives the active
 * single from the multi shape (Commit 2 back-compat) and renders
 * the summary without forcing them through the wizard.
 *
 * The wizard mounts under a `<Suspense fallback={null}>` boundary
 * inside the same Settings tree; the Settings screen does not need
 * a Suspense wrapper of its own. The fallback renders nothing
 * (blank space for the few hundred ms before the wizard chunk
 * resolves) because the trigger is a deliberate user click — no
 * empty-content flash on first Settings paint.
 */
export function AISettingsSection() {
  const { t } = useTranslation('ai-config');
  const { state, deleteConfig, acceptDisclaimer } = useAIConfig();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);

  function handleActivate() {
    if (state.disclaimerAccepted) {
      setWizardOpen(true);
      return;
    }
    setShowDisclaimer(true);
  }

  function handleDisclaimerConfirm() {
    acceptDisclaimer();
    setShowDisclaimer(false);
    setWizardOpen(true);
  }

  function handleDisclaimerCancel() {
    setShowDisclaimer(false);
  }

  function handleManage() {
    // The disclaimer was already accepted on first activation; do
    // not force it again on subsequent edits.
    setWizardOpen(true);
  }

  async function handleDeactivate() {
    await deleteConfig();
  }

  return (
    <section aria-labelledby="ai-settings-heading">
      <h2
        id="ai-settings-heading"
        className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('common:entity.ai-assistant')}
      </h2>
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
        <button
          type="button"
          onClick={() => setShowPrivacyInfo(true)}
          className="text-blue-700 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t('settings-section.privacy-link')}
        </button>
      </p>

      {state.status === 'loading' && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings-section.loading')}</p>
      )}

      {state.status === 'error' && (
        <p className="text-sm text-red-700 dark:text-red-300">{t('settings-section.error')}</p>
      )}

      {state.status === 'unconfigured' && <UnconfiguredView onActivate={handleActivate} />}

      {state.status === 'configured' && state.config && (
        <ConfiguredView
          config={state.config}
          onManage={handleManage}
          onDeactivate={() => void handleDeactivate()}
        />
      )}

      {showDisclaimer && (
        <AIDisclaimer onConfirm={handleDisclaimerConfirm} onCancel={handleDisclaimerCancel} />
      )}

      {wizardOpen && (
        <Suspense fallback={null}>
          <AiSetupWizard
            open={wizardOpen}
            onClose={() => setWizardOpen(false)}
            initial={
              state.status === 'configured' && state.config
                ? {
                    provider: state.config.provider,
                    apiKey: state.config.apiKey,
                    model: state.config.model,
                    baseUrl: state.config.baseUrl,
                  }
                : undefined
            }
          />
        </Suspense>
      )}

      <PrivacyInfoPopover open={showPrivacyInfo} onClose={() => setShowPrivacyInfo(false)} />
    </section>
  );
}

function UnconfiguredView({ onActivate }: { onActivate: () => void }) {
  const { t } = useTranslation('ai-config');
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <span aria-hidden>○</span> {t('settings-section.status-inactive')}
      </p>
      <button
        type="button"
        onClick={onActivate}
        data-testid="ai-settings-activate-btn"
        className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        {t('settings-section.activate-button')}
      </button>
    </div>
  );
}

function ConfiguredView({
  config,
  onManage,
  onDeactivate,
}: {
  config: AIProviderConfig;
  onManage: () => void;
  onDeactivate: () => void;
}) {
  const { t } = useTranslation('ai-config');
  const preset = getProviderPreset(config.provider);
  const providerLabel = preset?.label ?? config.provider;
  return (
    <div className="space-y-4">
      <p className="text-sm text-green-700 dark:text-green-400">
        <span aria-hidden>✓</span> {t('settings-section.status-configured')}
      </p>

      <dl
        data-testid="ai-settings-summary"
        className="space-y-1 rounded-sm border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/50"
      >
        <div className="flex gap-2">
          <dt className="font-medium text-gray-700 dark:text-gray-300">
            {t('settings-section.provider-label')}:
          </dt>
          <dd data-testid="ai-settings-provider-label" className="text-gray-900 dark:text-gray-100">
            {providerLabel}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-gray-700 dark:text-gray-300">
            {t('settings-section.api-key-label')}:
          </dt>
          <dd>
            <code
              data-testid="ai-settings-key-masked"
              className="text-xs text-gray-700 dark:text-gray-300"
            >
              {maskKey(config.provider, config.apiKey)}
            </code>
          </dd>
        </div>
        {config.model ? (
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700 dark:text-gray-300">
              {t('settings-section.model-label')}:
            </dt>
            <dd
              data-testid="ai-settings-model"
              className="font-mono text-xs text-gray-900 dark:text-gray-100"
            >
              {config.model}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onManage}
          data-testid="ai-settings-manage-btn"
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {t('settings-section.manage-button')}
        </button>
        <button
          type="button"
          onClick={onDeactivate}
          data-testid="ai-settings-deactivate-btn"
          className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          {t('settings-section.deactivate-button')}
        </button>
      </div>
    </div>
  );
}
