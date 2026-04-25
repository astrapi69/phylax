import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { UnlockView } from './UnlockView';
import { STORAGE_KEY, recordFailedAttempt } from './rateLimit';

const TEST_PASSWORD = 'test-password-12';
const onUnlocked = vi.fn();

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  onUnlocked.mockReset();
  sessionStorage.removeItem(STORAGE_KEY);
});

function renderUnlock() {
  return render(
    <MemoryRouter initialEntries={['/unlock']}>
      <Routes>
        <Route path="/unlock" element={<UnlockView onUnlocked={onUnlocked} />} />
        <Route
          path="/backup/import/select"
          element={<div data-testid="destination-import-select" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UnlockView', () => {
  it('renders password input', () => {
    renderUnlock();
    expect(screen.getByLabelText('Master-Passwort')).toBeInTheDocument();
  });

  it('submit disabled when empty', () => {
    renderUnlock();
    const button = screen.getByRole('button', { name: 'Entsperren' });
    expect(button).toBeDisabled();
  });

  it('wrong password shows error message', async () => {
    const user = userEvent.setup();
    renderUnlock();

    await user.type(screen.getByLabelText('Master-Passwort'), 'wrong-password1');
    await user.click(screen.getByRole('button', { name: 'Entsperren' }));

    await waitFor(
      () => {
        expect(screen.getByText('Falsches Passwort.')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('correct password calls onUnlocked', async () => {
    const user = userEvent.setup();
    renderUnlock();

    await user.type(screen.getByLabelText('Master-Passwort'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Entsperren' }));

    await waitFor(
      () => {
        expect(onUnlocked).toHaveBeenCalledOnce();
      },
      { timeout: 5000 },
    );

    lock();
  });

  it('renders backup-import link', () => {
    renderUnlock();
    const link = screen.getByRole('link', { name: 'Daten von Backup importieren' });
    expect(link).toHaveAttribute('href', '/backup/import/select');
  });

  it('shows countdown and disables input when rate-limited', () => {
    recordFailedAttempt();
    recordFailedAttempt();
    recordFailedAttempt();
    recordFailedAttempt();

    renderUnlock();

    expect(screen.getByText(/Gesperrt/)).toBeInTheDocument();
    expect(screen.getByLabelText('Master-Passwort')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Entsperren' })).toBeDisabled();
  });

  it('renders English translations when i18n is en', async () => {
    const { default: i18n } = await import('../../i18n/config');
    await i18n.changeLanguage('en');
    renderUnlock();
    expect(screen.getByRole('heading', { level: 1, name: 'Unlock Phylax' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import data from backup' })).toBeInTheDocument();
    await i18n.changeLanguage('de');
  });

  it('renders the forgotten-password reset link by default; opens ResetDialog when clicked', async () => {
    const user = userEvent.setup();
    renderUnlock();

    const link = screen.getByTestId('unlock-forgotten-password-link');
    expect(link).toBeInTheDocument();
    expect(screen.queryByTestId('reset-dialog')).not.toBeInTheDocument();

    await user.click(link);

    expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('unlock-forgotten-password-link')).not.toBeInTheDocument();
  });

  it('cancelling the ResetDialog returns to the link state', async () => {
    const user = userEvent.setup();
    renderUnlock();

    await user.click(screen.getByTestId('unlock-forgotten-password-link'));
    expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('reset-cancel-btn'));

    expect(screen.queryByTestId('reset-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('unlock-forgotten-password-link')).toBeInTheDocument();
  });

  it('password visibility toggle flips input type and aria-label', async () => {
    const user = userEvent.setup();
    renderUnlock();
    const input = screen.getByLabelText('Master-Passwort') as HTMLInputElement;
    const toggle = screen.getByTestId('password-visibility-toggle');

    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-label', 'Passwort anzeigen');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-label', 'Passwort verbergen');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('password visibility toggle is disabled during rate-limit lockout', async () => {
    // Push the rate limiter past its threshold so the input + toggle disable.
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt();
    }
    renderUnlock();
    const toggle = screen.getByTestId('password-visibility-toggle');
    expect(toggle).toBeDisabled();
    const input = screen.getByLabelText('Master-Passwort') as HTMLInputElement;
    expect(input).toBeDisabled();
  });
});
