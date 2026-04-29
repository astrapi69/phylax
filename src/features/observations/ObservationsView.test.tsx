import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';
import type { Profile } from '../../domain';
import { SearchProvider } from '../search-trigger';
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

/**
 * Render helper. P-22 architecture pivot: the global header owns
 * the magnifier trigger, so view-level tests must wrap in
 * `<SearchProvider>` to drive `isOpen`. `defaultOpen` lets tests
 * mount with the search bar already expanded without going
 * through a fake header click. MemoryRouter `initialEntries`
 * threads through; tests that exercise URL-seeded behaviour
 * (`?q=`, `?from=`) pass their own initial entry.
 */
function renderView({
  initialEntries = ['/observations'],
  defaultOpen,
}: {
  initialEntries?: string[];
  defaultOpen?: boolean;
} = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchProvider defaultOpen={defaultOpen}>
        <ObservationsView />
      </SearchProvider>
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
    await waitFor(() => expect(screen.getByText(/Noch keine Beobachtungen erfasst/)).toBeInTheDocument());
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue(new Error('boom'));
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/Beobachtungen konnten nicht geladen/);
    expect(consoleSpy).toHaveBeenCalledWith('[ObservationsView]', 'boom');
    consoleSpy.mockRestore();
  });

  describe('sort sections (V-02b)', () => {
    const NOW = Date.now();
    const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
    const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

    it('renders "Kürzlich aktualisiert" + "Alle Themen" when recent and old coexist', async () => {
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [
            makeObservation({ id: 'recent-1', theme: 'Schulter', updatedAt: NOW - TEN_DAYS }),
          ],
        },
        {
          theme: 'Adern',
          observations: [
            makeObservation({ id: 'old-1', theme: 'Adern', updatedAt: NOW - SIXTY_DAYS }),
          ],
        },
      ]);
      renderView();
      await waitFor(() =>
        expect(screen.getByTestId('section-heading-recent')).toHaveTextContent(
          'Kürzlich aktualisiert',
        ),
      );
      expect(screen.getByTestId('section-heading-all')).toHaveTextContent('Alle Themen');
    });

    it('omits both section headings when only recent themes exist', async () => {
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [
            makeObservation({ id: 'r1', theme: 'Schulter', updatedAt: NOW - TEN_DAYS }),
          ],
        },
      ]);
      renderView();
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument(),
      );
      expect(screen.queryByTestId('section-heading-recent')).not.toBeInTheDocument();
      expect(screen.queryByTestId('section-heading-all')).not.toBeInTheDocument();
    });

    it('switches to the alphabetical mode via the toggle, hiding section headings', async () => {
      await mockLoadedState([
        {
          theme: 'Zebra',
          observations: [makeObservation({ id: 'r1', theme: 'Zebra', updatedAt: NOW - TEN_DAYS })],
        },
        {
          theme: 'Adler',
          observations: [
            makeObservation({ id: 'o1', theme: 'Adler', updatedAt: NOW - SIXTY_DAYS }),
          ],
        },
      ]);
      const user = (await import('@testing-library/user-event')).default.setup();
      renderView();
      await waitFor(() => expect(screen.getByTestId('section-heading-recent')).toBeInTheDocument());

      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Sortierung' }),
        'alphabetical',
      );

      expect(screen.queryByTestId('section-heading-recent')).not.toBeInTheDocument();
      expect(screen.queryByTestId('section-heading-all')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Adler/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Zebra/ })).toBeInTheDocument();
    });

    it('hides the sort toggle when there are no observations', async () => {
      await mockLoadedState([]);
      renderView();
      await waitFor(() => expect(screen.getByText(/Noch keine Beobachtungen erfasst/)).toBeInTheDocument());
      expect(screen.queryByRole('combobox', { name: 'Sortierung' })).not.toBeInTheDocument();
    });
  });

  describe('post-commit highlight (V-02b)', () => {
    it('flags an observation updated within 5s of mount as highlighted', async () => {
      const now = Date.now();
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [
            makeObservation({ id: 'freshly-committed', theme: 'Schulter', updatedAt: now - 1000 }),
          ],
        },
      ]);
      renderView();
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument(),
      );
      const highlighted = document.querySelectorAll('details[data-highlighted="true"]');
      expect(highlighted).toHaveLength(1);
    });

    it('does NOT flag an observation updated 6+ seconds before mount (remount edge case)', async () => {
      // Scenario: user committed, navigated away for a few seconds, came
      // back. The observation's updatedAt is 6s old relative to this
      // mount -> no highlight. Documents that the highlight is strictly
      // tied to the current visit, not "user saw it last time".
      const now = Date.now();
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [
            makeObservation({ id: 'stale', theme: 'Schulter', updatedAt: now - 6000 }),
          ],
        },
      ]);
      renderView();
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument(),
      );
      expect(document.querySelectorAll('details[data-highlighted="true"]')).toHaveLength(0);
    });
  });

  describe('search (O-17)', () => {
    it('does NOT render the search bar when there are zero observations', async () => {
      await mockLoadedState([]);
      // Even with `defaultOpen=true` the empty branch returns the
      // EmptyStatePanel and skips the sticky bar entirely.
      renderView({ defaultOpen: true });
      await waitFor(() => expect(screen.getByText(/Noch keine Beobachtungen erfasst/)).toBeInTheDocument());
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('hides the inline search bar by default (header magnifier drives open state)', async () => {
      await mockLoadedState([
        { theme: 'Schulter', observations: [makeObservation({ id: '1', theme: 'Schulter' })] },
      ]);
      renderView();
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument(),
      );
      // P-22 pivot: header owns the magnifier; the view-body sticky
      // bar only renders when SearchContext.isOpen is true.
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('search-match-count')).not.toBeInTheDocument();
    });

    it('renders the inline search bar when SearchContext.isOpen is true', async () => {
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [makeObservation({ id: 's1', theme: 'Schulter', fact: 'schmerz' })],
        },
      ]);
      renderView({ defaultOpen: true });
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      const user = userEvent.setup();
      await user.type(input, 'schmerz');
      expect(input.value).toBe('schmerz');
    });

    it('clears query and dates when the X is clicked (Q15)', async () => {
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [makeObservation({ id: 's1', theme: 'Schulter', fact: 'schmerz' })],
        },
      ]);
      // URL has q + from -> SearchProvider auto-opens on mount.
      renderView({ initialEntries: ['/observations?q=schmerz&from=2024-01-01'] });
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      expect(input.value).toBe('schmerz');
      expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByTestId('search-input-clear'));
      // Both query and dates cleared, sticky bar collapses (no
      // searchbox, no date-range-filter).
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
    });

    it('filters by theme + fact + pattern, hides non-matching groups, shows match count', async () => {
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [
            makeObservation({ id: 's1', theme: 'Schulter', fact: 'stechender Schmerz' }),
            makeObservation({ id: 's2', theme: 'Schulter', fact: 'dumpfer Druck' }),
          ],
        },
        {
          theme: 'Knie',
          observations: [makeObservation({ id: 'k1', theme: 'Knie', fact: 'kein Treffer' })],
        },
      ]);
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      await user.type(input, 'stechend');

      await waitFor(() => {
        // P-19 + sticky-bar refinement: at exactly 1 match, the
        // counter shows the singular "1 Treffer" form (no "von Y").
        // Up/Down nav buttons are hidden under 2 matches.
        expect(screen.getByTestId('search-match-count')).toHaveTextContent('1 Treffer');
      });
      expect(screen.queryByTestId('search-prev')).not.toBeInTheDocument();
      expect(screen.queryByTestId('search-next')).not.toBeInTheDocument();
      // Knie group hidden, Schulter present but only the matching observation.
      expect(screen.queryByRole('heading', { level: 2, name: /Knie/ })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument();
    });

    it('renders Up/Down nav buttons only when match count is 2 or more', async () => {
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [
            makeObservation({ id: 's1', theme: 'Schulter', fact: 'schmerz schmerz' }),
            makeObservation({ id: 's2', theme: 'Schulter', fact: 'schmerz' }),
          ],
        },
      ]);
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      await user.type(await screen.findByRole('searchbox'), 'schmerz');

      await waitFor(() => {
        expect(screen.getByTestId('search-match-count')).toHaveTextContent('1 von 3 Treffer');
      });
      expect(screen.getByTestId('search-prev')).toBeInTheDocument();
      expect(screen.getByTestId('search-next')).toBeInTheDocument();
    });

    it('shows the no-matches message when query has zero hits', async () => {
      await mockLoadedState([
        { theme: 'Schulter', observations: [makeObservation({ id: '1', theme: 'Schulter' })] },
      ]);
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      await user.type(await screen.findByRole('searchbox'), 'xyz');

      await waitFor(() => {
        expect(screen.getByTestId('search-no-matches')).toHaveTextContent(/xyz/);
      });
      expect(screen.queryByRole('heading', { level: 2, name: /Schulter/ })).not.toBeInTheDocument();
    });

    it('renders the date range filter only after the user opens Stage 2 via the calendar toggle', async () => {
      await mockLoadedState([
        { theme: 'Schulter', observations: [makeObservation({ id: '1', theme: 'Schulter' })] },
      ]);
      renderView({ defaultOpen: true });
      await waitFor(() => expect(screen.getByTestId('calendar-toggle')).toBeInTheDocument());
      expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByTestId('calendar-toggle'));
      expect(await screen.findByTestId('date-range-filter')).toBeInTheDocument();
    });

    it('filters by `?from=` URL param applied to createdAt', async () => {
      const NOW = Date.now();
      const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
      const FAR_PAST = Date.parse('2020-01-01T12:00:00Z');
      await mockLoadedState([
        {
          theme: 'Recent',
          observations: [
            makeObservation({ id: 'r1', theme: 'Recent', updatedAt: NOW, createdAt: NOW - TEN_DAYS }),
          ],
        },
        {
          theme: 'Old',
          observations: [
            makeObservation({ id: 'o1', theme: 'Old', updatedAt: FAR_PAST, createdAt: FAR_PAST }),
          ],
        },
      ]);
      // URL ?from= -> SearchProvider auto-opens on mount.
      renderView({ initialEntries: ['/observations?from=2024-01-01'] });
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Recent/ })).toBeInTheDocument(),
      );
      expect(screen.queryByRole('heading', { level: 2, name: /Old/ })).not.toBeInTheDocument();
    });

    it('updates the URL when the user picks a date filter input (after opening Stage 2)', async () => {
      await mockLoadedState([
        { theme: 'Schulter', observations: [makeObservation({ id: '1', theme: 'Schulter' })] },
      ]);
      const user = userEvent.setup();
      renderView({ defaultOpen: true });
      await user.click(await screen.findByTestId('calendar-toggle'));
      const fromInput = (await screen.findByTestId('date-range-filter-from')) as HTMLInputElement;
      await user.type(fromInput, '2024-01-01');
      await waitFor(() => expect(fromInput.value).toBe('2024-01-01'));
    });

    it('seeds the search input from a `?q=` URL param', async () => {
      await mockLoadedState([
        {
          theme: 'Schulter',
          observations: [makeObservation({ id: '1', theme: 'Schulter', fact: 'schmerz' })],
        },
        {
          theme: 'Knie',
          observations: [makeObservation({ id: '2', theme: 'Knie', fact: 'andere' })],
        },
      ]);
      // URL ?q= -> SearchProvider auto-opens on mount, search input
      // pre-filled, filter applied.
      renderView({ initialEntries: ['/observations?q=schmerz'] });
      await waitFor(() => {
        expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('schmerz');
      });
      await waitFor(() => {
        expect(screen.queryByRole('heading', { level: 2, name: /Knie/ })).not.toBeInTheDocument();
      });
    });
  });
});
