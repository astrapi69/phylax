import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository } from '../../db/repositories';
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
});
