import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { resetDatabase } from '../../db/test-helpers';
import { OnboardingFlow } from './OnboardingFlow';

const VALID_PASSWORD = 'test-password-12';
const onComplete = vi.fn();

beforeEach(async () => {
  lock();
  await resetDatabase();
  onComplete.mockReset();
});

describe('OnboardingFlow', () => {
  it('renders password input', () => {
    render(<OnboardingFlow onComplete={onComplete} />);
    expect(screen.getByLabelText('Master-Passwort')).toBeInTheDocument();
  });

  it('shows strength indicator when typing', async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Master-Passwort'), 'abc');

    expect(screen.getByText('Schwach')).toBeInTheDocument();
  });

  it('shows error for weak password', async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Master-Passwort'), 'short');

    expect(screen.getByRole('alert')).toHaveTextContent('Mindestens 12 Zeichen');
  });

  it('shows confirm field after valid password', async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Master-Passwort'), VALID_PASSWORD);

    expect(screen.getByLabelText('Passwort wiederholen')).toBeInTheDocument();
  });

  it('requires checkbox before submit is enabled', async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Master-Passwort'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Passwort wiederholen'), VALID_PASSWORD);

    const submitButton = screen.getByRole('button', { name: 'Phylax einrichten' });
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByLabelText('Ich habe verstanden'));
    expect(submitButton).toBeEnabled();
  });

  it('successful submit calls onComplete', async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Master-Passwort'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Passwort wiederholen'), VALID_PASSWORD);
    await user.click(screen.getByLabelText('Ich habe verstanden'));
    await user.click(screen.getByRole('button', { name: 'Phylax einrichten' }));

    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledOnce();
      },
      { timeout: 5000 },
    );

    lock();
  });
});
