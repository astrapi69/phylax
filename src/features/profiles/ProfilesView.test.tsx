import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository } from '../../db/repositories';
import { ActiveProfileProvider, ACTIVE_PROFILE_STORAGE_KEY } from '../active-profile';
import { ProfilesView } from './ProfilesView';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

function NextLanding() {
  return <div data-testid="next-landing">on /profile</div>;
}

function renderView() {
  return render(
    <ActiveProfileProvider>
      <MemoryRouter initialEntries={['/profiles']}>
        <Routes>
          <Route path="/profiles" element={<ProfilesView />} />
          <Route path="/profile" element={<NextLanding />} />
          <Route path="/profile/create" element={<div data-testid="create" />} />
        </Routes>
      </MemoryRouter>
    </ActiveProfileProvider>,
  );
}

beforeEach(async () => {
  localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('ProfilesView (M-01)', () => {
  it('renders the heading and a card per profile', async () => {
    const repo = new ProfileRepository();
    await repo.create({
      baseData: {
        name: 'Anna',
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
      warningSigns: [],
      externalReferences: [],
      version: '1.0',
    });
    await repo.create({
      baseData: {
        name: 'Bernd',
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
      warningSigns: [],
      externalReferences: [],
      version: '1.0',
    });

    renderView();

    expect(screen.getByRole('heading', { name: 'Alle Profile' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument());
    expect(screen.getByText('Bernd')).toBeInTheDocument();
  });

  it('selecting a profile sets it active and routes to /profile', async () => {
    const repo = new ProfileRepository();
    const anna = await repo.create({
      baseData: {
        name: 'Anna',
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
      warningSigns: [],
      externalReferences: [],
      version: '1.0',
    });
    await repo.create({
      baseData: {
        name: 'Bernd',
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
      warningSigns: [],
      externalReferences: [],
      version: '1.0',
    });

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument());

    // Click Anna's "Aktivieren" button (label set by ProfilesView).
    const annaCard = screen.getByText('Anna').closest('[data-testid="profile-card"]');
    expect(annaCard).not.toBeNull();
    const activateBtn = annaCard?.querySelector('button');
    expect(activateBtn).not.toBeNull();
    if (!activateBtn) return;
    await user.click(activateBtn);

    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBe(anna.id);
    expect(screen.getByTestId('next-landing')).toBeInTheDocument();
  });

  it('clicking the create button routes to /profile/create', async () => {
    const repo = new ProfileRepository();
    await repo.create({
      baseData: {
        name: 'Anna',
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
      warningSigns: [],
      externalReferences: [],
      version: '1.0',
    });

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Neues Profil/ }));
    expect(screen.getByTestId('create')).toBeInTheDocument();
  });

  it('shows an alert when the load throws', async () => {
    const spy = vi
      .spyOn(ProfileRepository.prototype, 'list')
      .mockRejectedValueOnce(new Error('boom'));

    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toContain('boom');
    spy.mockRestore();
  });
});
