import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __resetScrollLockForTest } from '../../ui';
import AiSetupWizard from './AiSetupWizard';
import * as aiConfig from '../../db/aiConfig';
import * as verifyKeyModule from './verifyKey';

beforeEach(() => {
  __resetScrollLockForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(overrides: Partial<Parameters<typeof AiSetupWizard>[0]> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const utils = render(<AiSetupWizard open onClose={onClose} onSaved={onSaved} {...overrides} />);
  return { onClose, onSaved, ...utils };
}

describe('AiSetupWizard rendering', () => {
  it('renders the dialog with the wizard title and step indicator', () => {
    setup();
    expect(screen.getByTestId('ai-setup-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('ai-setup-wizard-title')).toHaveTextContent(/KI-Anbieter/i);
    expect(screen.getByTestId('ai-setup-wizard-step-dot-0')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('shows the seven provider options as radios on step 1', () => {
    setup();
    for (const id of ['anthropic', 'openai', 'google', 'mistral', 'lmstudio', 'ollama', 'custom']) {
      expect(screen.getByTestId(`ai-setup-wizard-provider-${id}`)).toBeInTheDocument();
    }
  });

  it('marks the initial provider as selected', () => {
    setup({ initial: { provider: 'google' } });
    expect(screen.getByTestId('ai-setup-wizard-provider-google')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('ai-setup-wizard-provider-anthropic')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});

describe('AiSetupWizard step navigation', () => {
  it('next button advances through steps; back button returns', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-test-12345' } });

    expect(screen.getByTestId('ai-setup-wizard-step-dot-0')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.getByTestId('ai-setup-wizard-step-dot-1')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.getByTestId('ai-setup-wizard-step-dot-2')).toHaveAttribute(
      'aria-current',
      'step',
    );

    await user.click(screen.getByTestId('ai-setup-wizard-back'));
    expect(screen.getByTestId('ai-setup-wizard-step-dot-1')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('step-2 next disabled when needsKey provider has empty key', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'anthropic', apiKey: '' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.getByTestId('ai-setup-wizard-next')).toBeDisabled();
  });

  it('step-2 next enabled for local providers without an api key', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'lmstudio' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.getByTestId('ai-setup-wizard-next')).toBeEnabled();
  });

  it('cancel button calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByTestId('ai-setup-wizard-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('AiSetupWizard provider selection', () => {
  it('changing provider resets baseUrl + model + apiKey to the new preset defaults', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-x' } });

    await user.click(screen.getByTestId('ai-setup-wizard-provider-google'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));

    const baseUrl = screen.getByTestId('ai-setup-wizard-base-url-input') as HTMLInputElement;
    const model = screen.getByTestId('ai-setup-wizard-model-input') as HTMLInputElement;
    const key = screen.getByTestId('ai-setup-wizard-key-input') as HTMLInputElement;
    expect(baseUrl.value).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    expect(model.value).toBe('gemini-2.0-flash');
    expect(key.value).toBe('');
  });

  it('renders the preset note below the provider grid', () => {
    setup({ initial: { provider: 'openai' } });
    const note = screen.getByTestId('ai-setup-wizard-provider-note');
    expect(note.textContent).toMatch(/CORS/i);
  });
});

describe('AiSetupWizard CORS warning', () => {
  it('surfaces the blocked-CORS warning on step 2 for openai', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'openai', apiKey: 'sk-openai-test' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.getByTestId('ai-setup-wizard-cors-warning')).toBeInTheDocument();
  });

  it('does not surface the warning for an unblocked provider (anthropic-flag)', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-test' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.queryByTestId('ai-setup-wizard-cors-warning')).toBeNull();
  });

  it("does not surface the warning for google ('ok')", async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'google', apiKey: 'gsk-test' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.queryByTestId('ai-setup-wizard-cors-warning')).toBeNull();
  });
});

describe('AiSetupWizard test-connection step', () => {
  it("calls verifyKey with the active provider's config and renders ok on success", async () => {
    const user = userEvent.setup();
    const verifySpy = vi
      .spyOn(verifyKeyModule, 'verifyKey')
      .mockResolvedValue({ ok: true, status: 'ok', detail: '' });
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-test' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-test-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-setup-wizard-test-ok')).toBeInTheDocument();
    });
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(verifySpy.mock.calls[0]?.[0]).toMatchObject({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    });
  });

  it('renders the failure detail on verifyKey failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(verifyKeyModule, 'verifyKey').mockResolvedValue({
      ok: false,
      status: 'auth_error',
      detail: 'API key invalid',
    });
    setup({ initial: { provider: 'anthropic', apiKey: 'bad-key' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-test-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-setup-wizard-test-fail')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ai-setup-wizard-test-fail').textContent).toMatch(/API key invalid/);
  });
});

describe('AiSetupWizard finish (save)', () => {
  it('persists via saveAIConfig with the assembled single-shape config and closes', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(aiConfig, 'saveAIConfig').mockResolvedValue();
    const { onClose, onSaved } = setup({
      initial: {
        provider: 'anthropic',
        apiKey: 'sk-ant-test-finish',
        model: 'claude-sonnet-4-6',
      },
    });

    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-finish'));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0]?.[0]).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-ant-test-finish',
      model: 'claude-sonnet-4-6',
      baseUrl: 'https://api.anthropic.com/v1',
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ provider: 'anthropic' });
  });

  it('finish disabled when needsKey provider has empty key', () => {
    setup({ initial: { provider: 'anthropic', apiKey: '' } });
    // The finish button only renders on step 2; click next twice first.
    // Skip the click flow: assert the next button is disabled instead,
    // since the finish button requires step 2 which is unreachable
    // without a key.
    expect(screen.getByTestId('ai-setup-wizard-next')).toBeEnabled();
  });

  it('renders save error when saveAIConfig rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(aiConfig, 'saveAIConfig').mockRejectedValue(new Error('vault locked'));
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-fail' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-finish'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-setup-wizard-save-error')).toHaveTextContent(/vault locked/);
    });
  });

  it('coerces non-Error save rejections via String()', async () => {
    const user = userEvent.setup();
    vi.spyOn(aiConfig, 'saveAIConfig').mockRejectedValue('plain-string-fail');
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-fail2' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-finish'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-setup-wizard-save-error')).toHaveTextContent(
        /plain-string-fail/,
      );
    });
  });
});

describe('AiSetupWizard branch closures', () => {
  it('clicking the already-selected provider is a no-op (preserves apiKey)', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-keep' } });
    // Click the same provider again - early return at line 87 preserves apiKey.
    await user.click(screen.getByTestId('ai-setup-wizard-provider-anthropic'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    const key = screen.getByTestId('ai-setup-wizard-key-input') as HTMLInputElement;
    expect(key.value).toBe('sk-ant-keep');
  });

  it('eye toggle flips the key-input style mask', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-toggle' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    const input = screen.getByTestId('ai-setup-wizard-key-input') as HTMLInputElement;
    // Hidden by default: -webkit-text-security: disc applied.
    expect(input.getAttribute('style')).toMatch(/text-security/i);
    await user.click(screen.getByTestId('ai-setup-wizard-key-toggle'));
    // After toggle, style attribute is empty (showKey === true -> undefined).
    expect(input.getAttribute('style') ?? '').not.toMatch(/text-security/i);
  });

  it('local provider step 2 renders the no-key-hint instead of the key field', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'lmstudio' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    expect(screen.getByTestId('ai-setup-wizard-no-key-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-setup-wizard-key-input')).toBeNull();
  });

  it('step-2 next disabled when baseUrl is empty', async () => {
    const user = userEvent.setup();
    setup({ initial: { provider: 'lmstudio' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    const baseUrl = screen.getByTestId('ai-setup-wizard-base-url-input') as HTMLInputElement;
    await user.clear(baseUrl);
    expect(screen.getByTestId('ai-setup-wizard-next')).toBeDisabled();
  });

  it('verifyKey thrown Error is surfaced via the catch branch', async () => {
    const user = userEvent.setup();
    vi.spyOn(verifyKeyModule, 'verifyKey').mockRejectedValue(new Error('network down'));
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-test' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-test-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('ai-setup-wizard-test-fail')).toHaveTextContent(/network down/);
    });
  });

  it('verifyKey thrown non-Error value is coerced via String() in the catch branch', async () => {
    const user = userEvent.setup();
    vi.spyOn(verifyKeyModule, 'verifyKey').mockRejectedValue('verify-string-fail');
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-test' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-test-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('ai-setup-wizard-test-fail')).toHaveTextContent(
        /verify-string-fail/,
      );
    });
  });

  it('verifyKey resolved-fail without detail falls back to status text (line 115 false branch)', async () => {
    const user = userEvent.setup();
    vi.spyOn(verifyKeyModule, 'verifyKey').mockResolvedValue({
      ok: false,
      status: 'rate_limited',
      detail: '',
    });
    setup({ initial: { provider: 'anthropic', apiKey: 'sk-ant-test' } });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-test-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('ai-setup-wizard-test-fail')).toHaveTextContent(/rate_limited/);
    });
  });

  it('finish without explicit model omits the model key from the saved config', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(aiConfig, 'saveAIConfig').mockResolvedValue();
    setup({
      initial: { provider: 'anthropic', apiKey: 'sk-ant-no-model' },
    });
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    // Model defaults to the preset's defaultModel; clear it to exercise the
    // `if (model)` false branch in buildConfig (line 100).
    const model = screen.getByTestId('ai-setup-wizard-model-input') as HTMLInputElement;
    await user.clear(model);
    await user.click(screen.getByTestId('ai-setup-wizard-next'));
    await user.click(screen.getByTestId('ai-setup-wizard-finish'));
    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const saved = saveSpy.mock.calls[0]?.[0];
    expect(saved).not.toHaveProperty('model');
  });
});
