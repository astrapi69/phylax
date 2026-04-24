import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImportSession } from './useImportSession';
import { AiCallError } from './aiCallError';
import type { ExtractedDrafts } from './drafts';
import type { CommitResult, DraftSelection } from './commit';
import type { PrepareResult, PrepareWithConsentResult, PreparedInput } from './types';
import type { ClassifyResult } from './classify';

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

function emptyDrafts(): ExtractedDrafts {
  return {
    observations: [
      {
        theme: 'A',
        fact: 'f',
        pattern: 'p',
        selfRegulation: 's',
        status: 'ok',
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

function fakePipeline() {
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
    extractEntries: vi.fn<() => Promise<ExtractedDrafts>>(async () => emptyDrafts()),
    commitDrafts: vi.fn<() => Promise<CommitResult>>(async () => ({
      observations: { attempted: 1, succeeded: 1, failed: 0 },
      labValues: { attempted: 0, succeeded: 0, failed: 0 },
      supplements: { attempted: 0, succeeded: 0, failed: 0 },
      openPoints: { attempted: 0, succeeded: 0, failed: 0 },
      labReportId: null,
      abortError: null,
    })),
  };
}

describe('useImportSession state machine', () => {
  it('starts in idle', () => {
    const { result } = renderHook(() => useImportSession());
    expect(result.current.state.kind).toBe('idle');
  });

  it('runs the happy path: pickFile → ready → classifying → reviewing', async () => {
    const pipeline = fakePipeline();
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });

    expect(pipeline.prepare).toHaveBeenCalledOnce();
    expect(pipeline.classifyDocument).toHaveBeenCalledOnce();
    expect(pipeline.extractEntries).toHaveBeenCalledOnce();
    expect(result.current.state.kind).toBe('reviewing');
    if (result.current.state.kind === 'reviewing') {
      expect(result.current.state.drafts.observations).toHaveLength(1);
      expect(result.current.state.selection.observations).toEqual([0]);
    }
  });

  it('routes to consent-prompt when prepare returns consent-required', async () => {
    const pipeline = fakePipeline();
    const file = txtFile('scan.pdf');
    pipeline.prepare.mockResolvedValueOnce({
      kind: 'consent-required',
      reason: 'pdf-rasterization',
      file,
    });
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(file);
    });

    expect(result.current.state.kind).toBe('consent-prompt');
    expect(pipeline.classifyDocument).not.toHaveBeenCalled();
  });

  it('continues to classify after grantConsent', async () => {
    const pipeline = fakePipeline();
    const file = txtFile('scan.pdf');
    pipeline.prepare.mockResolvedValueOnce({
      kind: 'consent-required',
      reason: 'pdf-rasterization',
      file,
    });
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(file);
    });
    await act(async () => {
      await result.current.grantConsent(false);
    });

    expect(pipeline.prepareWithConsent).toHaveBeenCalledWith(file, {
      rememberForSession: false,
    });
    expect(result.current.state.kind).toBe('reviewing');
  });

  it('returns to idle when consent is declined', async () => {
    const pipeline = fakePipeline();
    const file = txtFile('scan.pdf');
    pipeline.prepare.mockResolvedValueOnce({
      kind: 'consent-required',
      reason: 'pdf-rasterization',
      file,
    });
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(file);
    });
    act(() => {
      result.current.declineConsent();
    });

    expect(result.current.state.kind).toBe('idle');
    expect(pipeline.prepareWithConsent).not.toHaveBeenCalled();
  });

  it('halts at classification-confirm when AI returns uncertain', async () => {
    const pipeline = fakePipeline();
    pipeline.classifyDocument.mockResolvedValueOnce({
      classification: { type: 'doctor-letter', confidence: 0.5 },
      uncertain: true,
    });
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });

    expect(result.current.state.kind).toBe('classification-confirm');
    expect(pipeline.extractEntries).not.toHaveBeenCalled();
  });

  it('continues to extract after confirmClassification', async () => {
    const pipeline = fakePipeline();
    pipeline.classifyDocument.mockResolvedValueOnce({
      classification: { type: 'doctor-letter', confidence: 0.5 },
      uncertain: true,
    });
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });
    await act(async () => {
      await result.current.confirmClassification();
    });

    expect(pipeline.extractEntries).toHaveBeenCalledOnce();
    expect(result.current.state.kind).toBe('reviewing');
  });

  it('returns to idle when classification rejected', async () => {
    const pipeline = fakePipeline();
    pipeline.classifyDocument.mockResolvedValueOnce({
      classification: { type: 'doctor-letter', confidence: 0.5 },
      uncertain: true,
    });
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });
    act(() => {
      result.current.rejectClassification();
    });

    expect(result.current.state.kind).toBe('idle');
    expect(pipeline.extractEntries).not.toHaveBeenCalled();
  });

  it('surfaces AiCallError as ai error', async () => {
    const pipeline = fakePipeline();
    pipeline.classifyDocument.mockRejectedValueOnce(new AiCallError('rate-limit'));
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });

    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error' && result.current.state.error.kind === 'ai') {
      expect(result.current.state.error.ai.kind).toBe('rate-limit');
    }
  });

  it('surfaces non-AI prepare failure as prepare error', async () => {
    const pipeline = fakePipeline();
    pipeline.prepare.mockRejectedValueOnce(new Error('disk error'));
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });

    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('prepare');
    }
  });

  it('cancel resets to idle', async () => {
    const pipeline = fakePipeline();
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });
    act(() => {
      result.current.cancel();
    });

    expect(result.current.state.kind).toBe('idle');
  });

  it('retry re-runs prepare on the last file', async () => {
    const pipeline = fakePipeline();
    pipeline.prepare.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useImportSession({ pipeline }));

    await act(async () => {
      await result.current.pickFile(txtFile());
    });
    expect(result.current.state.kind).toBe('error');

    await act(async () => {
      await result.current.retry();
    });
    expect(pipeline.prepare).toHaveBeenCalledTimes(2);
    expect(result.current.state.kind).toBe('reviewing');
  });

  it('edits update the corresponding draft item', async () => {
    const pipeline = fakePipeline();
    const { result } = renderHook(() => useImportSession({ pipeline }));
    await act(async () => {
      await result.current.pickFile(txtFile());
    });

    act(() => {
      result.current.editObservation(0, { fact: 'edited fact' });
    });

    if (result.current.state.kind === 'reviewing') {
      expect(result.current.state.drafts.observations[0]?.fact).toBe('edited fact');
    } else {
      throw new Error('expected reviewing state');
    }
  });

  it('setSelection replaces the selection map', async () => {
    const pipeline = fakePipeline();
    const { result } = renderHook(() => useImportSession({ pipeline }));
    await act(async () => {
      await result.current.pickFile(txtFile());
    });

    const newSelection: DraftSelection = {
      observations: [],
      labValues: [],
      supplements: [],
      openPoints: [],
    };
    act(() => {
      result.current.setSelection(newSelection);
    });

    if (result.current.state.kind === 'reviewing') {
      expect(result.current.state.selection.observations).toEqual([]);
    }
  });

  it('commit transitions to done with the result', async () => {
    const pipeline = fakePipeline();
    const { result } = renderHook(() => useImportSession({ pipeline }));
    await act(async () => {
      await result.current.pickFile(txtFile());
    });

    await act(async () => {
      await result.current.commit({ sourceFileName: 'note.txt' });
    });

    expect(pipeline.commitDrafts).toHaveBeenCalledOnce();
    expect(result.current.state.kind).toBe('done');
  });

  it('commit failure surfaces as commit error', async () => {
    const pipeline = fakePipeline();
    pipeline.commitDrafts.mockRejectedValueOnce(new Error('crypto failure'));
    const { result } = renderHook(() => useImportSession({ pipeline }));
    await act(async () => {
      await result.current.pickFile(txtFile());
    });
    await act(async () => {
      await result.current.commit({ sourceFileName: 'note.txt' });
    });

    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('commit');
    }
  });
});
