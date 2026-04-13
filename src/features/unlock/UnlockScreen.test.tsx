import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { UnlockScreen } from './UnlockScreen';

const TEST_PASSWORD = 'test-password-12';
const onUnlocked = vi.fn();

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  onUnlocked.mockReset();
});

function renderUnlock() {
  return render(
    <MemoryRouter>
      <UnlockScreen onUnlocked={onUnlocked} />
    </MemoryRouter>,
  );
}

describe('UnlockScreen', () => {
  it('renders password input', () => {
    renderUnlock();
    expect(screen.getByLabelText('Master-Passwort')).toBeInTheDocument();
  });

  it('submit disabled when empty', () => {
    renderUnlock();
    const button = screen.getByRole('button', { name: 'Entsperren' });
    expect(button).toBeDisabled();
  });

  it('shows spinner during derivation', async () => {
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
});
