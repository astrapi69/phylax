import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../../db/repositories';
import { ProfileSelectionScreen } from './ProfileSelectionScreen';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

function renderScreen(onSelect = vi.fn(), onCancel = vi.fn()) {
  return render(
    <MemoryRouter>
      <ProfileSelectionScreen onSelect={onSelect} onCancel={onCancel} />
    </MemoryRouter>,
  );
}

describe('ProfileSelectionScreen', () => {
  it('renders profile cards with counts for existing profiles', async () => {
    const repo = new ProfileRepository();
    await repo.create({
      baseData: {
        name: 'Asterios',
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

    renderScreen();
    await screen.findByRole('heading', { name: /In welches Profil importieren/i });
    expect(screen.getByText('Asterios')).toBeInTheDocument();
    expect(await screen.findByText('Noch leer')).toBeInTheDocument();
  });

  it('shows non-empty counts when profile has data', async () => {
    const repo = new ProfileRepository();
    const p = await repo.create({
      baseData: {
        name: 'Mit Daten',
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
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId: p.id,
      theme: 'T',
      fact: 'f',
      pattern: 'p',
      selfRegulation: 's',
      status: 'a',
      source: 'user',
      extraSections: {},
    });

    renderScreen();
    await screen.findByText(/1 Beobachtung/);
  });

  it('clicking a profile calls onSelect with the id', async () => {
    const repo = new ProfileRepository();
    const p = await repo.create({
      baseData: {
        name: 'X',
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
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderScreen(onSelect);
    const btn = await screen.findByRole('button', { name: 'Diesem Profil zuordnen' });
    await user.click(btn);
    expect(onSelect).toHaveBeenCalledWith(p.id);
  });

  it('shows inline ProfileCreateForm after clicking "Neues Profil erstellen"', async () => {
    const repo = new ProfileRepository();
    await repo.create({
      baseData: {
        name: 'Existing',
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
    renderScreen();
    await screen.findByText('Existing');
    await user.click(screen.getByRole('button', { name: /Neues Profil erstellen/i }));
    expect(await screen.findByLabelText('Profilname')).toBeInTheDocument();
  });

  it('zero-profile branch shows the create-first explainer and inline form', async () => {
    renderScreen();
    await screen.findByRole('heading', { name: 'Profil erstellen' });
    expect(screen.getByText(/Erstelle zuerst ein Profil/)).toBeInTheDocument();
    expect(screen.getByLabelText('Profilname')).toBeInTheDocument();
  });

  it('cancel button calls onCancel when profiles exist', async () => {
    const repo = new ProfileRepository();
    await repo.create({
      baseData: {
        name: 'A',
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
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderScreen(vi.fn(), onCancel);
    await screen.findByText('A');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cards get aria-current reflecting selection state (not shown, default none)', async () => {
    const repo = new ProfileRepository();
    await repo.create({
      baseData: {
        name: 'A',
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
    renderScreen();
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    const card = screen.getByTestId('profile-card');
    expect(card).not.toHaveAttribute('aria-current');
  });
});
