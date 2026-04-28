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
      await waitFor(() => expect(screen.getByText(/Noch keine Beobachtungen/)).toBeInTheDocument());
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
    it('does NOT render the search input when there are zero observations', async () => {
      await mockLoadedState([]);
      renderView();
      await waitFor(() => expect(screen.getByText(/Noch keine Beobachtungen/)).toBeInTheDocument());
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('renders the search input when observations exist', async () => {
      await mockLoadedState([
        { theme: 'Schulter', observations: [makeObservation({ id: '1', theme: 'Schulter' })] },
      ]);
      renderView();
      await waitFor(() => expect(screen.getByRole('searchbox')).toBeInTheDocument());
      // Match-count is hidden when query is empty.
      expect(screen.queryByTestId('search-match-count')).not.toBeInTheDocument();
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
      renderView();
      await waitFor(() => expect(screen.getByRole('searchbox')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.type(screen.getByRole('searchbox'), 'stechend');

      await waitFor(() => {
        // P-19 changed the header counter from observation-count to
        // match-count. "stechend" matches once (in s1.fact), so total
        // matches is 1 and the active match is 1.
        expect(screen.getByTestId('search-match-count')).toHaveTextContent('1 von 1 Treffer');
      });
      // Knie group hidden, Schulter present but only the matching observation.
      expect(screen.queryByRole('heading', { level: 2, name: /Knie/ })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument();
    });

    it('shows the no-matches message when query has zero hits', async () => {
      await mockLoadedState([
        { theme: 'Schulter', observations: [makeObservation({ id: '1', theme: 'Schulter' })] },
      ]);
      renderView();
      await waitFor(() => expect(screen.getByRole('searchbox')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.type(screen.getByRole('searchbox'), 'xyz');

      await waitFor(() => {
        expect(screen.getByTestId('search-no-matches')).toHaveTextContent(/xyz/);
      });
      expect(screen.queryByRole('heading', { level: 2, name: /Schulter/ })).not.toBeInTheDocument();
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
      render(
        <MemoryRouter initialEntries={['/?q=schmerz']}>
          <ObservationsView />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('schmerz');
      });
      await waitFor(() => {
        expect(screen.queryByRole('heading', { level: 2, name: /Knie/ })).not.toBeInTheDocument();
      });
    });
  });
});
