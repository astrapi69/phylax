import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';
import type { Profile } from '../../domain';
import { ObservationsView } from './ObservationsView';
import { makeObservation } from './test-helpers';

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

afterEach(() => {
  vi.restoreAllMocks();
});

function renderView() {
  return render(
    <MemoryRouter>
      <ObservationsView />
    </MemoryRouter>,
  );
}

async function mockLoadedState(
  groups: { theme: string; observations: ReturnType<typeof makeObservation>[] }[],
) {
  const fakeProfile = {
    id: 'p1',
    profileId: 'p1',
    createdAt: 0,
    updatedAt: 0,
    baseData: {
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  } as unknown as Profile;

  vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(fakeProfile);
  const flat = groups.flatMap((g) => g.observations.map((o) => ({ ...o, theme: g.theme })));
  vi.spyOn(ObservationRepository.prototype, 'listByProfile').mockResolvedValue(flat);
}

describe('ObservationsView', () => {
  it('shows a loading indicator initially', () => {
    renderView();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the page heading', async () => {
    await mockLoadedState([]);
    renderView();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Beobachtungen' })).toBeInTheDocument(),
    );
  });

  it('shows the empty state with an import link when no observations exist', async () => {
    await mockLoadedState([]);
    renderView();
    await waitFor(() => expect(screen.getByText(/Noch keine Beobachtungen/)).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /Importiere ein Profil/ });
    expect(link).toHaveAttribute('href', '/import');
  });

  it('renders theme groups with their observations', async () => {
    await mockLoadedState([
      {
        theme: 'Schulter',
        observations: [makeObservation({ id: '1', theme: 'Schulter', fact: 'Fakt Schulter' })],
      },
      {
        theme: 'Knie',
        observations: [makeObservation({ id: '2', theme: 'Knie', fact: 'Fakt Knie' })],
      },
    ]);
    renderView();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { level: 2, name: /Knie/ })).toBeInTheDocument();
  });

  it('shows an error alert when loading fails', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue(new Error('boom'));
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/boom/);
  });
});
