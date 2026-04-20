import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { OpenPointRepository, ProfileRepository } from '../../db/repositories';
import type { OpenPoint, Profile } from '../../domain';
import { OpenPointsView } from './OpenPointsView';

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
      <OpenPointsView />
    </MemoryRouter>,
  );
}

function mockProfile(): Profile {
  return {
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
  };
}

function mockPoint(text: string, context: string, id = text, resolved = false): OpenPoint {
  return {
    id,
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    text,
    context,
    resolved,
  };
}

describe('OpenPointsView', () => {
  it('shows a loading indicator initially', () => {
    renderView();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders context groups when points are loaded', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(OpenPointRepository.prototype, 'listByProfile').mockResolvedValue([
      mockPoint('A', 'Arztbesuch'),
      mockPoint('B', 'Laufend'),
    ]);
    renderView();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Offene Punkte' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { level: 2, name: /Arztbesuch/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Laufend/ })).toBeInTheDocument();
  });

  it('shows empty state with import link when no points exist', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(OpenPointRepository.prototype, 'listByProfile').mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(screen.getByText(/Keine offenen Punkte/)).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /Importiere ein Profil/ });
    expect(link).toHaveAttribute('href', '/import');
  });

  it('shows an error alert when loading fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue(new Error('boom'));
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/Offene Punkte konnten nicht geladen/);
    expect(consoleSpy).toHaveBeenCalledWith('[OpenPointsView]', 'boom');
    consoleSpy.mockRestore();
  });
});
