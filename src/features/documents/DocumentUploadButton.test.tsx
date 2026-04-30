import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository } from '../../db/repositories';
import { DocumentUploadButton } from './DocumentUploadButton';

const TEST_PASSWORD = 'test-password-12';

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const { readMeta } = await import('../../db/meta');
  const { unlock } = await import('../../crypto');
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  await new ProfileRepository().create({
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
  });
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

async function selectFile(input: HTMLInputElement, file: File) {
  // applyAccept: false so userEvent does not pre-filter against the
  // `accept` attribute. The hook owns MIME validation; we want the
  // unsupported-type test path to actually fire.
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(input, file);
}

describe('DocumentUploadButton', () => {
  it('renders the idle label and a hidden file input', () => {
    render(<DocumentUploadButton />);
    expect(screen.getByText('Datei hochladen')).toBeInTheDocument();
    // The hidden file input is the labeled control.
    const input = screen.getByLabelText(/Datei hochladen/i);
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'application/pdf,image/png,image/jpeg,image/webp');
  });

  it('shows the unsupported-type error for an unaccepted MIME', async () => {
    render(<DocumentUploadButton />);
    const input = screen.getByLabelText(/Datei hochladen/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0])], 'note.txt', { type: 'text/plain' });

    await selectFile(input, file);

    await waitFor(() => expect(screen.getByTestId('upload-error')).toBeInTheDocument());
    expect(screen.getByTestId('upload-error').textContent).toMatch(/text\/plain/);
  });

  it('shows the success message after uploading an accepted file', async () => {
    const onUploaded = vi.fn();
    render(<DocumentUploadButton onUploaded={onUploaded} />);
    const input = screen.getByLabelText(/Datei hochladen/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'doc.pdf', {
      type: 'application/pdf',
    });

    await selectFile(input, file);

    await waitFor(() => expect(screen.getByTestId('upload-success')).toBeInTheDocument());
    expect(screen.getByTestId('upload-success').textContent).toMatch(/doc\.pdf/);
  });

  it('success message has a dismiss button (BUG-04)', async () => {
    render(<DocumentUploadButton />);
    const input = screen.getByLabelText(/Datei hochladen/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'bug04.pdf', {
      type: 'application/pdf',
    });
    await selectFile(input, file);
    await waitFor(() => expect(screen.getByTestId('upload-success')).toBeInTheDocument());

    const dismiss = screen.getByTestId('upload-success-dismiss');
    expect(dismiss).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(dismiss);
    expect(screen.queryByTestId('upload-success')).not.toBeInTheDocument();
  });
});
