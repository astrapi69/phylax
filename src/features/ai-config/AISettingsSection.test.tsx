import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { saveAIConfig, saveMultiAIConfig } from '../../db/aiConfig';
import { __resetScrollLockForTest } from '../../ui';
import { AISettingsSection } from './AISettingsSection';
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
  __resetScrollLockForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AISettingsSection (multi-provider summary, AI Commit 4b)', () => {
  it('renders the privacy link + heading even before the load effect resolves', () => {
    render(<AISettingsSection />);
    expect(screen.getByRole('heading', { name: 'KI-Assistent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Datenschutz beim KI-Chat' })).toBeInTheDocument();
  });

  it('unconfigured: shows Nicht aktiv + AI aktivieren button', async () => {
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByTestId('ai-settings-activate-btn')).toBeInTheDocument());
    expect(screen.getByText(/Nicht aktiv/)).toBeInTheDocument();
    expect(screen.queryByTestId('ai-settings-summary')).toBeNull();
  });

  it('configured (legacy single-shape Anthropic): renders summary card with masked key', async () => {
    await saveAIConfig({
      provider: 'anthropic',
      apiKey: 'sk-ant-abcdefghijklmnop-ABCD',
      model: 'claude-sonnet-4-6',
    });

    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());
    expect(screen.getByTestId('ai-settings-summary')).toBeInTheDocument();
    expect(screen.getByTestId('ai-settings-provider-label')).toHaveTextContent(
      'Anthropic (Claude)',
    );
    expect(screen.getByTestId('ai-settings-key-masked')).toHaveTextContent('sk-ant-...ABCD');
    expect(screen.getByTestId('ai-settings-key-masked')).not.toHaveTextContent(
      'sk-ant-abcdefghijklmnop-ABCD',
    );
    expect(screen.getByTestId('ai-settings-model')).toHaveTextContent('claude-sonnet-4-6');
  });

  it('configured (multi-shape with Google active): renders Google label + masked key', async () => {
    await saveMultiAIConfig({
      providers: [
        { provider: 'anthropic', apiKey: 'sk-ant-old-key-1234' },
        { provider: 'google', apiKey: 'gsk-active-key-WXYZ', model: 'gemini-2.0-flash' },
      ],
      activeProviderId: 'google',
    });

    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());
    expect(screen.getByTestId('ai-settings-provider-label')).toHaveTextContent('Google (Gemini)');
    expect(screen.getByTestId('ai-settings-key-masked')).toHaveTextContent('...WXYZ');
    expect(screen.getByTestId('ai-settings-model')).toHaveTextContent('gemini-2.0-flash');
  });

  it('"KI aktivieren" opens the disclaimer when not yet accepted', async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByTestId('ai-settings-activate-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('ai-settings-activate-btn'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /KI-Assistent aktivieren/i })).toBeInTheDocument(),
    );
  });

  it('"KI aktivieren" opens the wizard directly when disclaimer is already accepted', async () => {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByTestId('ai-settings-activate-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('ai-settings-activate-btn'));
    // Suspense fallback resolves once the lazy chunk loads. Wait for
    // the wizard's title element.
    await waitFor(() => expect(screen.getByTestId('ai-setup-wizard-title')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /KI-Assistent aktivieren/i })).toBeNull();
  });

  it('disclaimer confirm marks accepted + opens the wizard', async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByTestId('ai-settings-activate-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('ai-settings-activate-btn'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /KI-Assistent aktivieren/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /Verstanden, KI aktivieren/i }));
    await waitFor(() => expect(screen.getByTestId('ai-setup-wizard-title')).toBeInTheDocument());
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBe('true');
  });

  it('disclaimer cancel closes the disclaimer without opening the wizard', async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByTestId('ai-settings-activate-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('ai-settings-activate-btn'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /KI-Assistent aktivieren/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByTestId('ai-setup-wizard-title')).toBeNull();
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBeNull();
  });

  it('"Anbieter verwalten" opens the wizard pre-filled with the active provider', async () => {
    await saveAIConfig({
      provider: 'anthropic',
      apiKey: 'sk-ant-edit-flow-test',
      model: 'claude-sonnet-4-6',
    });
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByTestId('ai-settings-manage-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('ai-settings-manage-btn'));
    await waitFor(() => expect(screen.getByTestId('ai-setup-wizard-title')).toBeInTheDocument());
    // Anthropic preset is selected based on the saved active provider.
    expect(screen.getByTestId('ai-setup-wizard-provider-anthropic')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('"KI deaktivieren" clears the multi-provider config + returns to unconfigured view', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-deactivate-test' });
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() =>
      expect(screen.getByTestId('ai-settings-deactivate-btn')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('ai-settings-deactivate-btn'));
    await waitFor(() => expect(screen.getByTestId('ai-settings-activate-btn')).toBeInTheDocument());
    expect(screen.queryByTestId('ai-settings-summary')).toBeNull();
  });

  it('clicking Datenschutz opens the privacy info popover', async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Datenschutz beim KI-Chat' })).toBeInTheDocument(),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Datenschutz beim KI-Chat' }));
    const dialog = screen.getByRole('dialog');
    const labelledby = dialog.getAttribute('aria-labelledby');
    if (!labelledby) throw new Error('aria-labelledby missing on dialog');
    const heading = document.getElementById(labelledby);
    expect(heading?.textContent).toMatch(/Datenschutz beim KI-Chat/i);
  });

  it('does not mount the wizard chunk before the user clicks (lazy boundary)', async () => {
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByTestId('ai-settings-activate-btn')).toBeInTheDocument());
    expect(screen.queryByTestId('ai-setup-wizard')).toBeNull();
  });
});
