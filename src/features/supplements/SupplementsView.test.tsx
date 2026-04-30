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
import { SearchProvider } from '../search-trigger';
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

function renderView({
  initialEntries = ['/supplements'],
  defaultOpen,
}: {
  initialEntries?: string[];
  defaultOpen?: boolean;
} = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchProvider defaultOpen={defaultOpen}>
        <SupplementsView />
      </SearchProvider>
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
    await waitFor(() =>
      expect(screen.getByText(/Noch keine Supplemente erfasst/)).toBeInTheDocument(),
    );
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

  describe('search filter (P-22c)', () => {
    function mockTwoGroups() {
      vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
      vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([
        mockSupplement('Magnesium', 'daily'),
        mockSupplement('Vitamin D3', 'daily', 'vd3'),
        mockSupplement('Kreatin', 'paused'),
      ]);
    }

    it('does NOT render the inline search bar by default (header drives open state)', async () => {
      mockTwoGroups();
      renderView();
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Täglich/ })).toBeInTheDocument(),
      );
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('supplements-match-count')).not.toBeInTheDocument();
    });

    it('renders the inline search bar when SearchContext.isOpen is true', async () => {
      mockTwoGroups();
      renderView({ defaultOpen: true });
      expect(await screen.findByRole('searchbox')).toBeInTheDocument();
    });

    it('typing a query filters via group-keep semantic (child match)', async () => {
      mockTwoGroups();
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      await user.type(input, 'Magnesium');
      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 2 });
        expect(headings).toHaveLength(1);
      });
      // Daily group kept; group-keep keeps Vitamin D3 too.
      expect(screen.getByRole('heading', { level: 2, name: /Täglich/ })).toBeInTheDocument();
      expect(screen.getByText('Vitamin D3')).toBeInTheDocument();
      // Paused group hidden.
      expect(screen.queryByRole('heading', { level: 2, name: /Pausiert/ })).not.toBeInTheDocument();
    });

    it('group-label match keeps the group visible', async () => {
      mockTwoGroups();
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      await user.type(await screen.findByRole('searchbox'), 'pausiert');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /Pausiert/ })).toBeInTheDocument();
      });
      expect(screen.queryByRole('heading', { level: 2, name: /Täglich/ })).not.toBeInTheDocument();
    });

    it('shows the no-matches state when query has zero hits', async () => {
      mockTwoGroups();
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      await user.type(await screen.findByRole('searchbox'), 'xyz');
      await waitFor(() =>
        expect(screen.getByTestId('supplements-no-matches')).toHaveTextContent(/xyz/),
      );
    });

    it('seeds search input from `?q=` URL param via SearchProvider auto-open', async () => {
      mockTwoGroups();
      renderView({ initialEntries: ['/supplements?q=Magnesium'] });
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      expect(input.value).toBe('Magnesium');
    });

    it('renders prev/next match-nav when matchCount >= 2 (P-22b/c/d-polish)', async () => {
      mockTwoGroups();
      renderView({ defaultOpen: true });
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Täglich/ })).toBeInTheDocument(),
      );
      const user = userEvent.setup();
      // Broad query hitting both 'Täglich' (Magnesium / Vitamin D3) and
      // 'Pausiert' (Kreatin) groups via shared letter coverage.
      await user.type(await screen.findByRole('searchbox'), 'i');
      await waitFor(() => {
        expect(screen.queryByTestId('supplements-search-prev')).toBeInTheDocument();
        expect(screen.queryByTestId('supplements-search-next')).toBeInTheDocument();
      });
    });

    it('match-nav hidden when only one group is retained', async () => {
      mockTwoGroups();
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      await user.type(await screen.findByRole('searchbox'), 'Magnesium');
      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 2 });
        expect(headings).toHaveLength(1);
      });
      expect(screen.queryByTestId('supplements-search-prev')).not.toBeInTheDocument();
      expect(screen.queryByTestId('supplements-search-next')).not.toBeInTheDocument();
    });

    it('clears query when the SearchInput X button is clicked (Q15)', async () => {
      mockTwoGroups();
      renderView({ initialEntries: ['/supplements?q=Magnesium'] });
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      expect(input.value).toBe('Magnesium');
      const user = userEvent.setup();
      await user.click(screen.getByTestId('search-input-clear'));
      // Bar collapses when cleared.
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('hides the inline search bar when there are zero supplements (empty branch)', async () => {
      vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
      vi.spyOn(SupplementRepository.prototype, 'listByProfile').mockResolvedValue([]);
      renderView({ defaultOpen: true });
      await waitFor(() =>
        expect(screen.getByText(/Noch keine Supplemente erfasst/)).toBeInTheDocument(),
      );
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });
  });
});
