import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileCreateForm } from './ProfileCreateForm';

const TEST_PASSWORD = 'test-password-12';
const onComplete = vi.fn();

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const { readMeta } = await import('../../db/meta');
  const { unlock } = await import('../../crypto');
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
  onComplete.mockReset();
});

function renderForm() {
  return render(
    <MemoryRouter>
      <ProfileCreateForm onComplete={onComplete} />
    </MemoryRouter>,
  );
}

describe('ProfileCreateForm', () => {
  it('renders all form fields', () => {
    renderForm();
    expect(screen.getByLabelText('Profilname')).toBeInTheDocument();
    expect(screen.getByText('Für mich selbst')).toBeInTheDocument();
    expect(screen.getByText('Stellvertretend für jemand anderen')).toBeInTheDocument();
    expect(screen.getByLabelText('Initiale Version')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profil erstellen' })).toBeInTheDocument();
  });

  it('submit is disabled when name is empty', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Profil erstellen' })).toBeDisabled();
  });

  it('managedBy field is hidden when self is selected', () => {
    renderForm();
    expect(screen.queryByLabelText('Dein Name (als Betreuer)')).not.toBeInTheDocument();
  });

  it('managedBy field appears when proxy is selected', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText('Stellvertretend für jemand anderen'));
    expect(screen.getByLabelText('Dein Name (als Betreuer)')).toBeInTheDocument();
  });

  it('submit is disabled when proxy but managedBy is empty', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Profilname'), 'Test');
    await user.click(screen.getByText('Stellvertretend für jemand anderen'));

    expect(screen.getByRole('button', { name: 'Profil erstellen' })).toBeDisabled();
  });

  it('typing in fields updates component', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Profilname'), 'Mein Profil');
    expect(screen.getByLabelText('Profilname')).toHaveValue('Mein Profil');

    await user.clear(screen.getByLabelText('Initiale Version'));
    await user.type(screen.getByLabelText('Initiale Version'), '2.0');
    expect(screen.getByLabelText('Initiale Version')).toHaveValue('2.0');
  });

  it('successful submit calls onComplete', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Profilname'), 'Mein Profil');
    await user.click(screen.getByRole('button', { name: 'Profil erstellen' }));

    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledOnce();
      },
      { timeout: 5000 },
    );

    lock();
  });

  it('error state shows message', async () => {
    // Lock the keyStore to force a repository error
    lock();
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Profilname'), 'Test');
    await user.click(screen.getByRole('button', { name: 'Profil erstellen' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
