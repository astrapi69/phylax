import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { saveAIConfig, readAIConfig } from '../../db/aiConfig';
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AISettingsSection', () => {
  it('renders unconfigured state with key input and activate button', async () => {
    render(<AISettingsSection />);

    expect(screen.getByRole('heading', { name: 'KI-Assistent' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Nicht aktiv/)).toBeInTheDocument());
    expect(screen.getByLabelText('API-Schlüssel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KI aktivieren' })).toBeInTheDocument();
  });

  it('renders configured state with masked key and disable button', async () => {
    await saveAIConfig({
      provider: 'anthropic',
      apiKey: 'sk-ant-abcdefghijklmnop-ABCD',
      model: 'claude-sonnet-4-20250514',
    });

    render(<AISettingsSection />);

    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());
    expect(screen.getByTestId('ai-api-key-masked')).toHaveTextContent('sk-ant-...ABCD');
    expect(screen.getByTestId('ai-api-key-masked')).not.toHaveTextContent(
      'sk-ant-abcdefghijklmnop-ABCD',
    );
    expect(screen.getByRole('button', { name: 'KI deaktivieren' })).toBeInTheDocument();
  });

  it('shows Anthropic in the provider dropdown', async () => {
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByLabelText('Anbieter')).toBeInTheDocument());

    const provider = screen.getByLabelText('Anbieter') as HTMLSelectElement;
    expect(provider.options).toHaveLength(1);
    expect(provider.options[0]?.value).toBe('anthropic');
  });

  it('shows known Anthropic models in the model dropdown when configured', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-xxxxxxxxxxxxxxxxxxxx' });
    render(<AISettingsSection />);

    await waitFor(() => expect(screen.getByLabelText('Modell')).toBeInTheDocument());
    const select = screen.getByLabelText('Modell') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('claude-sonnet-4-20250514');
    expect(values).toContain('claude-haiku-4-5-20251001');
  });

  it('"KI aktivieren" opens the disclaimer when not yet accepted', async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'KI aktivieren' })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-ant-abcdefghijklmnop1234');
    await user.click(screen.getByRole('button', { name: 'KI aktivieren' }));

    expect(screen.getByRole('heading', { name: 'KI-Assistent aktivieren' })).toBeInTheDocument();
    // Config not saved yet - user must confirm disclaimer
    expect(await readAIConfig()).toBeNull();
  });

  it('activating, confirming disclaimer, persists the config and sets the flag', async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'KI aktivieren' })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-ant-abcdefghijklmnop1234');
    await user.click(screen.getByRole('button', { name: 'KI aktivieren' }));
    await user.click(screen.getByRole('button', { name: /Verstanden, KI aktivieren/ }));

    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());
    const stored = await readAIConfig();
    expect(stored?.apiKey).toBe('sk-ant-abcdefghijklmnop1234');
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBe('true');
  });

  it('"KI aktivieren" skips the disclaimer when it was accepted before', async () => {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'KI aktivieren' })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-ant-abcdefghijklmnop1234');
    await user.click(screen.getByRole('button', { name: 'KI aktivieren' }));

    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());
    expect(
      screen.queryByRole('heading', { name: 'KI-Assistent aktivieren' }),
    ).not.toBeInTheDocument();
  });

  it('"KI deaktivieren" removes the stored config and resets disclaimer flag', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-xxxxxxxxxxxxxxxxxxxx' });
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');

    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'KI deaktivieren' }));

    await waitFor(() => expect(screen.getByText(/Nicht aktiv/)).toBeInTheDocument());
    expect(await readAIConfig()).toBeNull();
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBeNull();
  });

  it('shows format warning for short/malformed keys', async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByLabelText('API-Schlüssel')).toBeInTheDocument());

    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-proj-xyz');

    expect(screen.getByRole('alert')).toHaveTextContent(/ungewöhnlich/);
  });

  it('activate button is disabled when the key input is empty', async () => {
    render(<AISettingsSection />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'KI aktivieren' })).toBeInTheDocument(),
    );

    expect(screen.getByRole('button', { name: 'KI aktivieren' })).toBeDisabled();
  });

  it('"Ändern" reveals an input to replace the stored key without going through the disclaimer', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-xxxxxxxxxxxxxxxxOLD1' });
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Ändern' }));
    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-ant-xxxxxxxxxxxxxxxxNEW2');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(screen.getByTestId('ai-api-key-masked')).toHaveTextContent('sk-ant-...NEW2'),
    );
    const stored = await readAIConfig();
    expect(stored?.apiKey).toBe('sk-ant-xxxxxxxxxxxxxxxxNEW2');
  });

  it('canceling "Ändern" does not modify the stored key', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-xxxxxxxxxxxxxxxxKEEP' });
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await waitFor(() => expect(screen.getByText(/Konfiguriert/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Ändern' }));
    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-ant-never-saved');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() =>
      expect(screen.getByTestId('ai-api-key-masked')).toHaveTextContent('sk-ant-...KEEP'),
    );
    const stored = await readAIConfig();
    expect(stored?.apiKey).toBe('sk-ant-xxxxxxxxxxxxxxxxKEEP');
  });

  it('renders the Datenschutz link below the heading in every state', async () => {
    render(<AISettingsSection />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Datenschutz beim KI-Chat' })).toBeInTheDocument(),
    );
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
    expect(dialog).toHaveAttribute('aria-labelledby', 'privacy-info-title');
    expect(screen.getByText(/30 Tage zur Sicherheitsprüfung/)).toBeInTheDocument();
  });
});
