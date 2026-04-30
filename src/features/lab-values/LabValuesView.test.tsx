import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { __resetScrollLockForTest } from '../../ui';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { LabReportRepository, LabValueRepository, ProfileRepository } from '../../db/repositories';
import type { LabReport, Profile } from '../../domain';
import { SearchProvider } from '../search-trigger';
import { LabValuesView } from './LabValuesView';

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

/**
 * Render helper. P-22 architecture pivot: the global header owns
 * the magnifier trigger, so view-level tests must wrap in
 * `<SearchProvider>` to drive `isOpen`. `defaultOpen` lets tests
 * mount with the inline search bar already expanded without
 * simulating a header click. Tests that exercise URL-seeded
 * behaviour pass an `initialEntries` whose path is `/lab-values...`
 * so `hasSearch=true` triggers the auto-open default.
 */
function renderView({
  initialEntries = ['/lab-values'],
  defaultOpen,
}: {
  initialEntries?: string[];
  defaultOpen?: boolean;
} = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchProvider defaultOpen={defaultOpen}>
        <LabValuesView />
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

describe('LabValuesView', () => {
  it('shows a loading indicator initially', () => {
    renderView();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the page heading and report cards when loaded', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    const report: LabReport = {
      id: 'lr1',
      profileId: 'p1',
      createdAt: 1,
      updatedAt: 1,
      reportDate: '2026-02-27',
      labName: 'TestLab',
      categoryAssessments: {},
    };
    vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([
      report,
    ]);
    vi.spyOn(LabValueRepository.prototype, 'listByReport').mockResolvedValue([]);

    renderView();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Laborwerte' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { level: 2, name: /27\.02\.2026/ })).toBeInTheDocument();
  });

  it('shows the empty state with an import link when no reports exist', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([]);

    renderView();
    await waitFor(() => expect(screen.getByText(/Noch keine Laborwerte erfasst/)).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /Importiere ein Profil/ });
    expect(link).toHaveAttribute('href', '/import');
  });

  it('shows an error alert when loading fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue(new Error('boom'));
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/Laborwerte konnten nicht geladen/);
    expect(consoleSpy).toHaveBeenCalledWith('[LabValuesView]', 'boom');
    consoleSpy.mockRestore();
  });

  it('renders the AddLabReportButton in the header even on empty state', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(screen.getByTestId('add-lab-report-btn')).toBeInTheDocument());
  });

  it('clicking AddLabReportButton opens the create form', async () => {
    const user = userEvent.setup();
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(screen.getByTestId('add-lab-report-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('add-lab-report-btn'));
    expect(screen.getByTestId('lab-report-form-title')).toHaveTextContent('Neuer Befund');
  });

  it('renders add-value footer on each report when reports exist', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    const report: LabReport = {
      id: 'lr1',
      profileId: 'p1',
      createdAt: 1,
      updatedAt: 1,
      reportDate: '2026-02-27',
      categoryAssessments: {},
    };
    vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([
      report,
    ]);
    vi.spyOn(LabValueRepository.prototype, 'listByReport').mockResolvedValue([]);

    renderView();
    await waitFor(() => expect(screen.getByTestId('add-lab-value-btn-lr1')).toBeInTheDocument());
  });

  it('clicking add-value opens the value form in create mode', async () => {
    const user = userEvent.setup();
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    const report: LabReport = {
      id: 'lr1',
      profileId: 'p1',
      createdAt: 1,
      updatedAt: 1,
      reportDate: '2026-02-27',
      categoryAssessments: {},
    };
    vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([
      report,
    ]);
    vi.spyOn(LabValueRepository.prototype, 'listByReport').mockResolvedValue([]);
    vi.spyOn(LabValueRepository.prototype, 'listParameters').mockResolvedValue([]);

    renderView();
    await waitFor(() => expect(screen.getByTestId('add-lab-value-btn-lr1')).toBeInTheDocument());
    await user.click(screen.getByTestId('add-lab-value-btn-lr1'));
    await waitFor(() => expect(screen.getByTestId('lab-value-form-title')).toBeInTheDocument());
    expect(screen.getByTestId('lab-value-form-title')).toHaveTextContent('Neuer Wert');
  });

  describe('date range filter (O-18)', () => {
    function mockTwoReports() {
      vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
      vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([
        {
          id: 'lr1',
          profileId: 'p1',
          createdAt: 1,
          updatedAt: 1,
          reportDate: '2026-06-15',
          categoryAssessments: {},
        },
        {
          id: 'lr2',
          profileId: 'p1',
          createdAt: 2,
          updatedAt: 2,
          reportDate: '2024-01-01',
          categoryAssessments: {},
        },
      ]);
      vi.spyOn(LabValueRepository.prototype, 'listByReport').mockResolvedValue([]);
    }

    it('renders the date range filter only after the user opens Stage 2 via the calendar toggle', async () => {
      mockTwoReports();
      renderView({ defaultOpen: true });
      // Stage 1 (search bar inline): calendar toggle visible, dates hidden.
      await waitFor(() => expect(screen.getByTestId('calendar-toggle')).toBeInTheDocument());
      expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByTestId('calendar-toggle'));
      expect(await screen.findByTestId('date-range-filter')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-filter-from')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-filter-to')).toBeInTheDocument();
    });

    it('does NOT render the inline search bar or date range filter when there are zero reports', async () => {
      vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
      vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([]);

      renderView({ defaultOpen: true });
      await waitFor(() => expect(screen.getByText(/Noch keine Laborwerte erfasst/)).toBeInTheDocument());
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
    });

    it('filters reports by `?from=` URL param', async () => {
      mockTwoReports();
      // SearchProvider auto-opens on mount because URL has ?from=.
      renderView({ initialEntries: ['/lab-values?from=2026-01-01'] });
      await waitFor(() => expect(screen.getByTestId('date-range-filter')).toBeInTheDocument());
      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings).toHaveLength(1);
      expect(headings[0]?.textContent).toMatch(/15\.06\.2026/);
    });

    it('filters reports by `?to=` URL param', async () => {
      mockTwoReports();
      renderView({ initialEntries: ['/lab-values?to=2025-01-01'] });
      await waitFor(() => expect(screen.getByTestId('date-range-filter')).toBeInTheDocument());
      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings).toHaveLength(1);
      expect(headings[0]?.textContent).toMatch(/01\.01\.2024/);
    });

    it('shows the no-matches state when the date range excludes every report', async () => {
      mockTwoReports();
      renderView({ initialEntries: ['/lab-values?from=2030-01-01&to=2030-12-31'] });
      await waitFor(() =>
        expect(screen.getByTestId('lab-values-no-matches')).toBeInTheDocument(),
      );
      expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    });

    it('updates the URL when the user picks a from date (after opening Stage 2)', async () => {
      mockTwoReports();
      const user = userEvent.setup();
      renderView({ defaultOpen: true });
      await user.click(await screen.findByTestId('calendar-toggle'));
      const fromInput = (await screen.findByTestId('date-range-filter-from')) as HTMLInputElement;
      await user.type(fromInput, '2026-01-01');
      await waitFor(() => expect(fromInput.value).toBe('2026-01-01'));
    });
  });

  describe('search filter (P-22b)', () => {
    function mockSynlabAndOther() {
      vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
      vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([
        {
          id: 'syn',
          profileId: 'p1',
          createdAt: 1,
          updatedAt: 1,
          reportDate: '2026-06-15',
          labName: 'Synlab',
          categoryAssessments: {},
        },
        {
          id: 'oth',
          profileId: 'p1',
          createdAt: 2,
          updatedAt: 2,
          reportDate: '2024-01-01',
          labName: 'Other',
          categoryAssessments: {},
        },
      ]);
      vi.spyOn(LabValueRepository.prototype, 'listByReport').mockImplementation(
        async (reportId: string) => {
          if (reportId === 'syn') {
            return [
              {
                id: 'v1',
                profileId: 'p1',
                reportId: 'syn',
                createdAt: 1,
                updatedAt: 1,
                category: 'Nierenwerte',
                parameter: 'Kreatinin',
                result: '1.0',
              },
              {
                id: 'v2',
                profileId: 'p1',
                reportId: 'syn',
                createdAt: 2,
                updatedAt: 2,
                category: 'Schilddrüse',
                parameter: 'TSH',
                result: '2.4',
              },
            ];
          }
          return [];
        },
      );
    }

    it('hides the inline search bar by default (header magnifier drives open state)', async () => {
      mockSynlabAndOther();
      renderView();
      await waitFor(() =>
        expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0),
      );
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lab-values-match-count')).not.toBeInTheDocument();
    });

    it('renders the inline search bar with calendar toggle when SearchContext.isOpen is true', async () => {
      mockSynlabAndOther();
      renderView({ defaultOpen: true });
      expect(await screen.findByRole('searchbox')).toBeInTheDocument();
      expect(screen.getByTestId('calendar-toggle')).toBeInTheDocument();
      // Date inputs hidden until calendar toggle clicked.
      expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
    });

    it('typing a query filters reports via row-keep semantic', async () => {
      mockSynlabAndOther();
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      await user.type(input, 'Kreatinin');
      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 2 });
        expect(headings).toHaveLength(1);
      });
      // Q10 row-keep: Kreatinin match in syn report keeps ALL its values.
      expect(screen.getByText('Kreatinin')).toBeInTheDocument();
      expect(screen.getByText('TSH')).toBeInTheDocument();
      // Other report hidden.
      expect(screen.queryByText('Other')).not.toBeInTheDocument();
    });

    it('shows the no-matches state when query has zero hits', async () => {
      mockSynlabAndOther();
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      await user.type(await screen.findByRole('searchbox'), 'xyz');
      await waitFor(() =>
        expect(screen.getByTestId('lab-values-no-matches')).toHaveTextContent(/xyz/),
      );
    });

    it('seeds the search input from `?q=` on mount via SearchProvider auto-open', async () => {
      mockSynlabAndOther();
      // URL ?q= -> SearchProvider auto-opens; input pre-filled.
      renderView({ initialEntries: ['/lab-values?q=Synlab'] });
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      expect(input.value).toBe('Synlab');
      // Calendar toggle visible (still Stage 1; date param absent).
      expect(screen.getByTestId('calendar-toggle')).toBeInTheDocument();
      expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
    });

    it('renders prev/next match-nav buttons when the filter retains >= 2 reports (P-22b/c/d-polish)', async () => {
      // Both reports' labNames contain a literal 'l' (Synlab + Other-via-Lab patch).
      // Use a date filter to keep both visible regardless of value content: the
      // YYYY range covers both reportDates. Filter retains both => totalMatches == 2.
      mockSynlabAndOther();
      renderView({ initialEntries: ['/lab-values?from=2024-01-01&to=2026-12-31'] });
      await waitFor(() =>
        expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(2),
      );
      // Date filter alone keeps two reports visible. matchCount == 2 in
      // filterLabReports' empty-query branch when the date range is active
      // (filterResult.matchCount equals retained.length).
      await waitFor(() => {
        expect(screen.queryByTestId('lab-values-search-prev')).toBeInTheDocument();
        expect(screen.queryByTestId('lab-values-search-next')).toBeInTheDocument();
      });
    });

    it('match-nav buttons hidden when matchCount < 2', async () => {
      mockSynlabAndOther();
      renderView({ defaultOpen: true });
      const user = userEvent.setup();
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      // Query matches only one report.
      await user.type(input, 'Kreatinin');
      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 2 });
        expect(headings).toHaveLength(1);
      });
      expect(screen.queryByTestId('lab-values-search-prev')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lab-values-search-next')).not.toBeInTheDocument();
    });

    it('clears query and dates when the SearchInput X button is clicked (Q15)', async () => {
      mockSynlabAndOther();
      renderView({ initialEntries: ['/lab-values?q=Synlab&from=2025-01-01'] });
      const input = (await screen.findByRole('searchbox')) as HTMLInputElement;
      expect(input.value).toBe('Synlab');
      // Mounts at Stage 2 because date is set.
      expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByTestId('search-input-clear'));
      // Both query and dates cleared, sticky bar collapses (no
      // searchbox, no date-range-filter).
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
    });
  });

  it('renders multiple reports in order', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(mockProfile());
    vi.spyOn(LabReportRepository.prototype, 'listByProfileDateDescending').mockResolvedValue([
      {
        id: 'lr1',
        profileId: 'p1',
        createdAt: 1,
        updatedAt: 1,
        reportDate: '2026-06-15',
        categoryAssessments: {},
      },
      {
        id: 'lr2',
        profileId: 'p1',
        createdAt: 2,
        updatedAt: 2,
        reportDate: '2024-01-01',
        categoryAssessments: {},
      },
    ]);
    vi.spyOn(LabValueRepository.prototype, 'listByReport').mockResolvedValue([]);

    renderView();
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2));
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]?.textContent).toMatch(/15\.06\.2026/);
    expect(headings[1]?.textContent).toMatch(/01\.01\.2024/);
  });
});
