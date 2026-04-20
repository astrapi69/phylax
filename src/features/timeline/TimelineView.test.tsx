import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository, TimelineEntryRepository } from '../../db/repositories';
import type { Profile, TimelineEntry } from '../../domain';
import { TimelineView } from './TimelineView';

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
      <TimelineView />
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

function mockEntry(id: string, period: string, title: string, createdAt = 1): TimelineEntry {
  return {
    id,
    profileId: 'p1',
    createdAt,
    updatedAt: createdAt,
    period,
    title,
    content: `Content ${id}`,
    source: 'user',
  };
}

describe('TimelineView', () => {
  it('shows a loading indicator initially', () => {
    renderView();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders timeline entries when loaded', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    // listChronological returns ascending; hook reverses to newest-first
    vi.spyOn(TimelineEntryRepository.prototype, 'listChronological').mockResolvedValue([
      mockEntry('old', 'Januar 2024', 'Erste', 1),
      mockEntry('new', 'Maerz 2026', 'Neueste', 2),
    ]);
    renderView();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Verlauf' })).toBeInTheDocument(),
    );
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]?.textContent).toBe('Maerz 2026');
    expect(headings[1]?.textContent).toBe('Januar 2024');
  });

  it('shows empty state with import link when no entries exist', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(TimelineEntryRepository.prototype, 'listChronological').mockResolvedValue([]);
    renderView();
    await waitFor(() =>
      expect(screen.getByText(/Noch keine Verlaufseintraege/)).toBeInTheDocument(),
    );
    const link = screen.getByRole('link', { name: /Importiere ein Profil/ });
    expect(link).toHaveAttribute('href', '/import');
  });

  it('shows an error alert when loading fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue(new Error('boom'));
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(
      /Verlaufseintraege konnten nicht geladen/,
    );
    expect(consoleSpy).toHaveBeenCalledWith('[TimelineView]', 'boom');
    consoleSpy.mockRestore();
  });
});
