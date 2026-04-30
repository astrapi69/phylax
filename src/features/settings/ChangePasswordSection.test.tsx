import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { deriveKeyFromPassword, unlockWithKey, lock, getLockState } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { __resetAutoLockPauseStateForTests } from '../auto-lock/pauseStore';
import { ChangePasswordSection } from './ChangePasswordSection';

const OLD = 'current-password-12';
const NEW = 'next-password-345';

async function unlockWith(password: string): Promise<void> {
  const meta = await readMeta();
  if (!meta) throw new Error('meta missing in fixture');
  const key = await deriveKeyFromPassword(password, new Uint8Array(meta.salt));
  if (getLockState() === 'unlocked') lock();
  unlockWithKey(key);
}

beforeEach(async () => {
  __resetAutoLockPauseStateForTests();
  await setupCompletedOnboarding(OLD);
  await unlockWith(OLD);
});

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  current: string,
  next: string,
  confirm: string,
) {
  await user.type(screen.getByLabelText(/aktuelles master-passwort/i), current);
  await user.type(screen.getByLabelText(/neues master-passwort/i), next);
  await user.type(screen.getByLabelText(/passwort bestätigen/i), confirm);
}

describe('ChangePasswordSection', () => {
  it('renders heading + three password fields + submit', () => {
    render(<ChangePasswordSection />);
    expect(screen.getByRole('heading', { name: /master-passwort ändern/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/aktuelles master-passwort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/neues master-passwort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/passwort bestätigen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /master-passwort ändern/i })).toBeInTheDocument();
  });

  it('submit disabled while any field is empty', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);
    const submit = screen.getByRole('button', { name: /master-passwort ändern/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/aktuelles master-passwort/i), OLD);
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/neues master-passwort/i), NEW);
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/passwort bestätigen/i), NEW);
    expect(submit).not.toBeDisabled();
  });

  it('submitting opens the confirmation modal', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);
    await fillForm(user, OLD, NEW, NEW);
    await user.click(screen.getByRole('button', { name: /master-passwort ändern/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Bestätigen/i })).toBeInTheDocument();
  });

  it('confirm + happy path renders the success banner and clears the form', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);
    await fillForm(user, OLD, NEW, NEW);
    await user.click(screen.getByRole('button', { name: /master-passwort ändern/i }));
    await user.click(screen.getByRole('button', { name: /Ja, ändern/i }));

    await waitFor(() =>
      expect(screen.getByText(/Master-Passwort wurde erfolgreich geändert/i)).toBeInTheDocument(),
    );

    expect(screen.getByLabelText(/aktuelles master-passwort/i)).toHaveValue('');
    expect(screen.getByLabelText(/neues master-passwort/i)).toHaveValue('');
    expect(screen.getByLabelText(/passwort bestätigen/i)).toHaveValue('');
  });

  it('wrong current password shows inline error and keeps form populated', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);
    await fillForm(user, 'this-is-not-my-pw', NEW, NEW);
    await user.click(screen.getByRole('button', { name: /master-passwort ändern/i }));
    await user.click(screen.getByRole('button', { name: /Ja, ändern/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/aktuelle Master-Passwort/i),
    );
    expect(screen.getByLabelText(/aktuelles master-passwort/i)).toHaveValue('this-is-not-my-pw');
  });

  it('mismatch surfaces inline error', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);
    await fillForm(user, OLD, NEW, 'different-password-99');
    await user.click(screen.getByRole('button', { name: /master-passwort ändern/i }));
    await user.click(screen.getByRole('button', { name: /Ja, ändern/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/stimmen nicht überein/i),
    );
  });

  it('cancelling the confirmation does not run the operation', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);
    await fillForm(user, OLD, NEW, NEW);
    await user.click(screen.getByRole('button', { name: /master-passwort ändern/i }));
    await user.click(screen.getByRole('button', { name: /Abbrechen/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Form values preserved.
    expect(screen.getByLabelText(/aktuelles master-passwort/i)).toHaveValue(OLD);
  });
});
