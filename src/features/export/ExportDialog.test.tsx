import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';
import { ExportDialog } from './ExportDialog';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfile(): Promise<void> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  await new ProfileRepository().create({
    baseData: {
      name: 'Max',
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
}

beforeEach(async () => {
  // Stub URL.createObjectURL for the download trigger.
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  URL.revokeObjectURL = vi.fn();
  // Swallow anchor click so jsdom does not try to navigate.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ExportDialog open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the Markdown option and focuses the close button when open', async () => {
    await seedProfile();
    render(<ExportDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'export-dialog-title');
    expect(screen.getByRole('heading', { name: 'Profil exportieren' })).toBeInTheDocument();
    expect(screen.getByTestId('export-markdown-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
  });

  it('clicking Markdown loads the profile and triggers a download', async () => {
    await seedProfile();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExportDialog open={true} onClose={onClose} />);

    await user.click(screen.getByTestId('export-markdown-button'));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
    });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows an error when no profile exists', async () => {
    lock();
    await setupCompletedOnboarding(TEST_PASSWORD);
    await unlockSession();

    const user = userEvent.setup();
    render(<ExportDialog open={true} onClose={vi.fn()} />);

    await user.click(screen.getByTestId('export-markdown-button'));
    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toHaveTextContent(/Kein Profil/);
    });
  });

  it('Escape key calls onClose', async () => {
    await seedProfile();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExportDialog open={true} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe('date range filter (X-03)', () => {
    it('renders the DateRangeFilter inside the dialog', async () => {
      await seedProfile();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByTestId('export-date-range')).toBeInTheDocument();
      expect(screen.getByTestId('export-date-range-from')).toBeInTheDocument();
      expect(screen.getByTestId('export-date-range-to')).toBeInTheDocument();
    });

    it('user can set both bounds and trigger a Markdown export with the filter applied', async () => {
      await seedProfile();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);

      const fromInput = screen.getByTestId('export-date-range-from') as HTMLInputElement;
      const toInput = screen.getByTestId('export-date-range-to') as HTMLInputElement;
      await user.type(fromInput, '2025-01-01');
      await user.type(toInput, '2026-12-31');
      expect(fromInput.value).toBe('2025-01-01');
      expect(toInput.value).toBe('2026-12-31');

      await user.click(screen.getByTestId('export-markdown-button'));
      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalledOnce();
      });
    });

    it('partial range (from-only) is accepted and exports without crashing', async () => {
      await seedProfile();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);

      await user.type(screen.getByTestId('export-date-range-from'), '2025-06-01');
      await user.click(screen.getByTestId('export-markdown-button'));

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalledOnce();
      });
    });
  });

  describe('themes filter (X-04)', () => {
    it('hides the theme filter section when the profile has no observations', async () => {
      await seedProfile();
      vi.spyOn(ObservationRepository.prototype, 'listThemes').mockResolvedValue([]);
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('export-markdown-button')).toBeInTheDocument());
      expect(screen.queryByTestId('export-themes-filter')).not.toBeInTheDocument();
    });

    it('renders a checkbox for each available theme, all checked by default', async () => {
      await seedProfile();
      vi.spyOn(ObservationRepository.prototype, 'listThemes').mockResolvedValue([
        'Schulter',
        'Knie',
      ]);
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('export-themes-filter')).toBeInTheDocument());
      const schulter = screen.getByTestId('export-themes-checkbox-Schulter') as HTMLInputElement;
      const knie = screen.getByTestId('export-themes-checkbox-Knie') as HTMLInputElement;
      expect(schulter.checked).toBe(true);
      expect(knie.checked).toBe(true);
    });

    it('toggling a checkbox unchecks the theme', async () => {
      await seedProfile();
      vi.spyOn(ObservationRepository.prototype, 'listThemes').mockResolvedValue(['Schulter']);
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('export-themes-filter')).toBeInTheDocument());

      const checkbox = screen.getByTestId('export-themes-checkbox-Schulter') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
      await user.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('exports the selected subset when at least one theme is unchecked', async () => {
      await seedProfile();
      vi.spyOn(ObservationRepository.prototype, 'listThemes').mockResolvedValue([
        'Schulter',
        'Knie',
      ]);
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('export-themes-filter')).toBeInTheDocument());

      await user.click(screen.getByTestId('export-themes-checkbox-Knie'));
      await user.click(screen.getByTestId('export-markdown-button'));

      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());
    });
  });

  describe('preview workflow (X-07)', () => {
    it('renders three preview buttons (one per format)', async () => {
      await seedProfile();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() =>
        expect(screen.getByTestId('export-markdown-preview')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('export-pdf-preview')).toBeInTheDocument();
      expect(screen.getByTestId('export-csv-preview')).toBeInTheDocument();
    });

    it('clicking Markdown Preview opens the preview modal with rendered content', async () => {
      await seedProfile();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);

      await user.click(screen.getByTestId('export-markdown-preview'));
      await waitFor(() =>
        expect(screen.getByTestId('export-preview-markdown')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('export-preview-download')).toBeInTheDocument();
      expect(screen.getByTestId('export-preview-close')).toBeInTheDocument();
    });

    it('clicking CSV Preview opens the preview modal with the empty placeholder when no labs', async () => {
      await seedProfile();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);

      await user.click(screen.getByTestId('export-csv-preview'));
      await waitFor(() =>
        expect(screen.getByTestId('export-preview-empty')).toBeInTheDocument(),
      );
    });

    it('Close from inside preview returns to the dialog without downloading', async () => {
      await seedProfile();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);

      await user.click(screen.getByTestId('export-markdown-preview'));
      await waitFor(() =>
        expect(screen.getByTestId('export-preview-markdown')).toBeInTheDocument(),
      );
      await user.click(screen.getByTestId('export-preview-close'));
      await waitFor(() =>
        expect(screen.queryByTestId('export-preview-markdown')).not.toBeInTheDocument(),
      );
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('Download from inside preview triggers the download and closes the dialog', async () => {
      await seedProfile();
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={onClose} />);

      await user.click(screen.getByTestId('export-markdown-preview'));
      await waitFor(() =>
        expect(screen.getByTestId('export-preview-download')).toBeInTheDocument(),
      );
      await user.click(screen.getByTestId('export-preview-download'));
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('CSV export (X-06)', () => {
    it('renders the CSV format button', async () => {
      await seedProfile();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() =>
        expect(screen.getByTestId('export-csv-button')).toBeInTheDocument(),
      );
    });

    it('clicking CSV triggers a download', async () => {
      await seedProfile();
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={onClose} />);

      await user.click(screen.getByTestId('export-csv-button'));
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('linked-documents appendix toggle (X-05)', () => {
    it('renders the appendix checkbox unchecked by default', async () => {
      await seedProfile();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('export-markdown-button')).toBeInTheDocument());
      const checkbox = screen.getByTestId('export-appendix-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('toggling the checkbox flips the include-linked-documents state', async () => {
      await seedProfile();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('export-appendix-checkbox')).toBeInTheDocument());
      const checkbox = screen.getByTestId('export-appendix-checkbox') as HTMLInputElement;
      await user.click(checkbox);
      expect(checkbox.checked).toBe(true);
      await user.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('export still works when the checkbox is on (no documents present)', async () => {
      await seedProfile();
      const user = userEvent.setup();
      render(<ExportDialog open={true} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('export-appendix-checkbox')).toBeInTheDocument());

      await user.click(screen.getByTestId('export-appendix-checkbox'));
      await user.click(screen.getByTestId('export-markdown-button'));
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());
    });
  });
});
