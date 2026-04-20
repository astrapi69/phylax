import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import i18n from '../../i18n/config';
import { SetupView } from './SetupView';
import { lock } from '../../crypto';
import { resetDatabase } from '../../db/test-helpers';

vi.mock('./useLazyZxcvbn', () => ({
  useLazyZxcvbn: () => ({ ready: false, error: null, score: undefined }),
}));

function renderInRouter() {
  return render(
    <MemoryRouter initialEntries={['/setup']}>
      <Routes>
        <Route path="/setup" element={<SetupView />} />
        <Route path="/profile/create" element={<div data-testid="destination-profile-create" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const VALID_PASSWORD = 'setup-password-12';

describe('SetupView', () => {
  beforeEach(async () => {
    lock();
    await resetDatabase();
    if (i18n.language !== 'de') {
      void i18n.changeLanguage('de');
    }
  });

  it('renders the headline and intro', () => {
    renderInRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Master-Passwort festlegen' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Master-Passwort')).toBeInTheDocument();
  });

  it('focuses the h1 on mount', () => {
    renderInRouter();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveAttribute('tabindex', '-1');
  });

  it('shows strength indicator when password has content', async () => {
    const user = userEvent.setup();
    renderInRouter();
    await user.type(screen.getByLabelText('Master-Passwort'), 'abcdefghijkl');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows validation message for too-short password', async () => {
    const user = userEvent.setup();
    renderInRouter();
    await user.type(screen.getByLabelText('Master-Passwort'), 'short');
    expect(screen.getByText(/Mindestens 12 Zeichen/)).toBeInTheDocument();
  });

  it('disables submit until password, confirm, and acknowledgment are valid', async () => {
    const user = userEvent.setup();
    renderInRouter();
    const submit = screen.getByRole('button', { name: 'Phylax einrichten' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Master-Passwort'), VALID_PASSWORD);
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Passwort wiederholen'), VALID_PASSWORD);
    expect(submit).toBeDisabled();

    await user.click(screen.getByLabelText('Ich habe verstanden'));
    expect(submit).toBeEnabled();
  });

  it('navigates to /profile/create after successful setup', async () => {
    const user = userEvent.setup();
    renderInRouter();

    await user.type(screen.getByLabelText('Master-Passwort'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Passwort wiederholen'), VALID_PASSWORD);
    await user.click(screen.getByLabelText('Ich habe verstanden'));
    await user.click(screen.getByRole('button', { name: 'Phylax einrichten' }));

    await waitFor(
      () => expect(screen.getByTestId('destination-profile-create')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('renders the warning callout with acknowledgment checkbox', () => {
    renderInRouter();
    expect(screen.getByLabelText('Ich habe verstanden')).toBeInTheDocument();
    expect(screen.getByText(/Wenn du dein Passwort vergisst/)).toBeInTheDocument();
  });

  it('renders English translations when i18n language is en', async () => {
    await i18n.changeLanguage('en');
    renderInRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Set your master password' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up Phylax' })).toBeInTheDocument();
    await i18n.changeLanguage('de');
  });
});
