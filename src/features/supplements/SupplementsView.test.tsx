import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository, SupplementRepository } from '../../db/repositories';
import type { Profile, Supplement, SupplementCategory } from '../../domain';
import { __resetScrollLockForTest } from '../../ui';
import { SupplementsView } from './SupplementsView';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  __resetScrollLockForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderView() {
  return render(
    <MemoryRouter>
      <SupplementsView />
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

function mockSupplement(
  name: string,
  category: SupplementCategory,
  id = name,
  createdAt = 1,
): Supplement {
  return {
    id,
    profileId: 'p1',
    createdAt,
    updatedAt: createdAt,
    name,
    category,
  };
}

describe('SupplementsView', () => {
  it('shows a loading indicator initially', () => {
    renderView();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders category groups when supplements are loaded', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([
      mockSupplement('Vitamin D', 'daily'),
      mockSupplement('Omega 3', 'daily', 'o3', 2),
      mockSupplement('Kreatin', 'paused'),
    ]);
    renderView();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Supplemente' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { level: 2, name: /Täglich/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Pausiert/ })).toBeInTheDocument();
  });

  it('shows empty state with import link when no supplements exist', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(screen.getByText(/Noch keine Supplemente/)).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /Importiere ein Profil/ });
    expect(link).toHaveAttribute('href', '/import');
  });

  it('shows an error alert when loading fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue(new Error('boom'));
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/Supplemente konnten nicht geladen/);
    expect(consoleSpy).toHaveBeenCalledWith('[SupplementsView]', 'boom');
    consoleSpy.mockRestore();
  });

  it('renders the AddSupplementButton in the header even on empty state', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(screen.getByTestId('add-supplement-btn')).toBeInTheDocument());
  });

  it('clicking AddSupplementButton opens the create form', async () => {
    const user = userEvent.setup();
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(screen.getByTestId('add-supplement-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('add-supplement-btn'));
    expect(screen.getByTestId('supplement-form-title')).toHaveTextContent('Neues Supplement');
  });

  it('renders per-card actions on each supplement when populated', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([
      mockSupplement('Vitamin D', 'daily'),
    ]);
    renderView();
    await waitFor(() => expect(screen.getByTestId('supplement-actions')).toBeInTheDocument());
  });

  it('renders paused group after active groups', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([
      mockSupplement('P1', 'paused'),
      mockSupplement('D1', 'daily'),
    ]);
    renderView();
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2));
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]?.textContent).toMatch(/Täglich/);
    expect(headings[1]?.textContent).toMatch(/Pausiert/);
  });
});
