import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../../i18n/config';
import { ImportFlow } from './ImportFlow';
import { AiCallError } from '../aiCallError';
import type { ExtractedDrafts } from '../drafts';
import type { CommitResult } from '../commit';
import type { PrepareResult, PrepareWithConsentResult, PreparedInput } from '../types';
import type { ClassifyResult } from '../classify';
import type { commitDrafts } from '../commit';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function txtFile(name = 'note.txt'): File {
  return new File(['hello'], name, { type: 'text/plain' });
}

function preparedInput(): PreparedInput {
  return {
    mode: 'text',
    textContent: 'hello',
    sourceFile: { name: 'note.txt', type: 'text/plain', size: 5 },
  };
}

function drafts(): ExtractedDrafts {
  return {
    observations: [
      {
        theme: 'Schulter',
        fact: 'Schmerz',
        pattern: 'Belastung',
        selfRegulation: 'Krafttraining',
        status: 'in Besserung',
        source: 'ai',
        extraSections: {},
      },
    ],
    labValues: [],
    supplements: [],
    openPoints: [],
    labReportMeta: {},
  };
}

function happyResult(): CommitResult {
  return {
    observations: { attempted: 1, succeeded: 1, failed: 0 },
    labValues: { attempted: 0, succeeded: 0, failed: 0 },
    supplements: { attempted: 0, succeeded: 0, failed: 0 },
    openPoints: { attempted: 0, succeeded: 0, failed: 0 },
    labReportId: null,
    abortError: null,
  };
}

function fakes() {
  return {
    prepare: vi.fn<(file: File) => Promise<PrepareResult>>(async () => ({
      kind: 'ready',
      input: preparedInput(),
    })),
    prepareWithConsent: vi.fn<
      (file: File, opts?: { rememberForSession?: boolean }) => Promise<PrepareWithConsentResult>
    >(async () => ({ kind: 'ready', input: preparedInput() })),
    classifyDocument: vi.fn<() => Promise<ClassifyResult>>(async () => ({
      classification: { type: 'lab-report', confidence: 0.95 },
      uncertain: false,
    })),
    extractEntries: vi.fn<() => Promise<ExtractedDrafts>>(async () => drafts()),
    commitDrafts: vi.fn<typeof commitDrafts>(async () => happyResult()),
  };
}

describe('ImportFlow', () => {
  it('renders dialog with title + memory hint', async () => {
    const pipeline = fakes();
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    expect(screen.getByText('Dokument importieren')).toBeInTheDocument();
    expect(screen.getByText(/nur im Arbeitsspeicher/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
  });

  it('shows preparing/classifying status before reviewing', async () => {
    const pipeline = fakes();
    let resolveClassify!: () => void;
    pipeline.classifyDocument.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClassify = () =>
            resolve({
              classification: { type: 'lab-report', confidence: 0.95 },
              uncertain: false,
            });
        }),
    );
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('status-classifying')).toBeInTheDocument());
    resolveClassify();
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
  });

  it('renders ConsentDialog when prepare returns consent-required', async () => {
    const pipeline = fakes();
    pipeline.prepare.mockResolvedValueOnce({
      kind: 'consent-required',
      reason: 'pdf-rasterization',
      file: txtFile('scan.pdf'),
    });
    render(
      <ImportFlow
        initialFile={txtFile('scan.pdf')}
        onClose={vi.fn()}
        pipelineOverrides={pipeline}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('consent-dialog')).toBeInTheDocument());
  });

  it('grants consent and continues to classify+review', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    pipeline.prepare.mockResolvedValueOnce({
      kind: 'consent-required',
      reason: 'pdf-rasterization',
      file: txtFile('scan.pdf'),
    });
    render(
      <ImportFlow
        initialFile={txtFile('scan.pdf')}
        onClose={vi.fn()}
        pipelineOverrides={pipeline}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('consent-dialog')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Verarbeiten' }));
    await waitFor(() => expect(pipeline.prepareWithConsent).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
  });

  it('declines consent and closes via onDecline', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const pipeline = fakes();
    pipeline.prepare.mockResolvedValueOnce({
      kind: 'consent-required',
      reason: 'pdf-rasterization',
      file: txtFile('scan.pdf'),
    });
    render(
      <ImportFlow
        initialFile={txtFile('scan.pdf')}
        onClose={onClose}
        pipelineOverrides={pipeline}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('consent-dialog')).toBeInTheDocument());
    const dialog = screen.getByTestId('consent-dialog');
    const cancelBtn = within(dialog).getByRole('button', { name: 'Abbrechen' });
    await user.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects classification and returns to idle', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    pipeline.classifyDocument.mockResolvedValueOnce({
      classification: { type: 'doctor-letter', confidence: 0.5 },
      uncertain: true,
    });
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('classification-confirm')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nein, abbrechen' }));
    await waitFor(() => expect(screen.queryByTestId('classification-confirm')).toBeNull());
  });

  it('renders ClassificationConfirm and continues to extract on confirm', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    pipeline.classifyDocument.mockResolvedValueOnce({
      classification: { type: 'doctor-letter', confidence: 0.5 },
      uncertain: true,
    });
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('classification-confirm')).toBeInTheDocument());
    expect(pipeline.extractEntries).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ja, fortfahren' }));
    await waitFor(() => expect(pipeline.extractEntries).toHaveBeenCalled());
  });

  it('disables commit button when nothing selected', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());

    // Uncheck the only observation row.
    const obsRow = screen.getByTestId('observation-row');
    const checkbox = obsRow.querySelector('input[type="checkbox"]');
    if (!checkbox) throw new Error('expected checkbox');
    await user.click(checkbox);

    const button = screen.getByRole('button', { name: 'Keine Auswahl' });
    expect(button).toBeDisabled();
  });

  it('calls commitDrafts with the source filename and shows success summary', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    render(
      <ImportFlow
        initialFile={txtFile('mein-doc.pdf')}
        onClose={vi.fn()}
        pipelineOverrides={pipeline}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
    const commitBtn = screen.getByRole('button', { name: '1 übernehmen' });
    await user.click(commitBtn);
    await waitFor(() => expect(pipeline.commitDrafts).toHaveBeenCalled());
    const callArgs = pipeline.commitDrafts.mock.calls[0];
    if (!callArgs) throw new Error('expected commit call');
    expect(callArgs[2]).toEqual({ sourceFileName: 'mein-doc.pdf' });
    await waitFor(() => expect(screen.getByTestId('import-flow-done')).toBeInTheDocument());
  });

  it('surfaces ai error and shows retry button for retryable kind', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    pipeline.classifyDocument.mockRejectedValueOnce(new AiCallError('rate-limit'));
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('import-flow-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    expect(screen.getByText(/AI-Anbieter limitiert/)).toBeInTheDocument();

    pipeline.classifyDocument.mockResolvedValueOnce({
      classification: { type: 'lab-report', confidence: 0.95 },
      uncertain: false,
    });
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
  });

  it('hides retry for non-retryable ai error (auth)', async () => {
    const pipeline = fakes();
    pipeline.classifyDocument.mockRejectedValueOnce(new AiCallError('auth'));
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('import-flow-error')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
  });

  it('shows no-profile message when commit aborts on missing profile', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    pipeline.commitDrafts.mockResolvedValueOnce({
      ...happyResult(),
      observations: { attempted: 0, succeeded: 0, failed: 0 },
      abortError: 'no-profile',
    });
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '1 übernehmen' }));
    await waitFor(() =>
      expect(screen.getByTestId('import-flow-done-no-profile')).toBeInTheDocument(),
    );
  });

  it('cancels on Escape and calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const pipeline = fakes();
    render(<ImportFlow initialFile={txtFile()} onClose={onClose} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders commit-error message when commitDrafts throws', async () => {
    const user = userEvent.setup();
    const pipeline = fakes();
    pipeline.commitDrafts.mockRejectedValueOnce(new Error('write failed'));
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '1 übernehmen' }));
    await waitFor(() => expect(screen.getByTestId('import-flow-error')).toBeInTheDocument());
    expect(screen.getByText(/write failed/)).toBeInTheDocument();
  });

  it('renders prepare-error message when prepare throws non-AI error', async () => {
    const pipeline = fakes();
    pipeline.prepare.mockRejectedValueOnce(new Error('disk read failed'));
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('import-flow-error')).toBeInTheDocument());
    expect(screen.getByText(/disk read failed/)).toBeInTheDocument();
  });

  it('done-state Schließen button calls onClose with the commit result', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const pipeline = fakes();
    render(<ImportFlow initialFile={txtFile()} onClose={onClose} pipelineOverrides={pipeline} />);
    await waitFor(() => expect(screen.getByTestId('review-panel')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '1 übernehmen' }));
    await waitFor(() => expect(screen.getByTestId('import-flow-done')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalled();
    const lastCall = onClose.mock.calls[onClose.mock.calls.length - 1];
    if (!lastCall) throw new Error('expected close call');
    expect(lastCall[0]).toMatchObject({ abortError: null });
  });

  it('exposes role=dialog with aria-modal=true', async () => {
    const pipeline = fakes();
    render(<ImportFlow initialFile={txtFile()} onClose={vi.fn()} pipelineOverrides={pipeline} />);
    const dialog = await screen.findByRole('dialog', { name: 'Dokument importieren' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
