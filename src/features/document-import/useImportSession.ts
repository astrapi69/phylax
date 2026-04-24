import { useCallback, useMemo, useReducer, useRef } from 'react';
import { prepare, prepareWithConsent } from './prepare';
import { classifyDocument } from './classify';
import { extractEntries } from './extract';
import { commitDrafts, type CommitOptions, type CommitResult, type DraftSelection } from './commit';
import { AiCallError } from './aiCallError';
import { EMPTY_DRAFTS } from './drafts';
import type {
  ExtractedDrafts,
  LabValueDraft,
  ObservationDraft,
  OpenPointDraft,
  SupplementDraft,
} from './drafts';
import type { ConsentRequiredReason, DocumentClassification, PreparedInput } from './types';

/**
 * State machine for the IMP-04 import session.
 *
 * One reducer drives the whole flow (idle → preparing → ... →
 * reviewing → committing → done). Cancellable async stages thread
 * AbortSignal through; cancellation collapses to `idle`.
 *
 * The hook owns the in-memory source `File`. On any terminal
 * transition (commit success, cancel, error dismiss) the file
 * reference is dropped so the modal cannot leak Blobs across
 * sessions.
 */
export type ImportSessionState =
  | { kind: 'idle' }
  | { kind: 'preparing'; file: File }
  | {
      kind: 'consent-prompt';
      file: File;
      reason: ConsentRequiredReason;
    }
  | { kind: 'classifying'; input: PreparedInput }
  | {
      kind: 'classification-confirm';
      input: PreparedInput;
      classification: DocumentClassification;
    }
  | {
      kind: 'extracting';
      input: PreparedInput;
      classification: DocumentClassification;
    }
  | {
      kind: 'reviewing';
      input: PreparedInput;
      classification: DocumentClassification;
      drafts: ExtractedDrafts;
      selection: DraftSelection;
    }
  | {
      kind: 'committing';
      input: PreparedInput;
      classification: DocumentClassification;
      drafts: ExtractedDrafts;
      selection: DraftSelection;
    }
  | { kind: 'done'; result: CommitResult }
  | { kind: 'error'; error: ImportSessionError };

export type ImportSessionError =
  | { kind: 'prepare'; message: string }
  | { kind: 'ai'; ai: AiCallError }
  | { kind: 'commit'; message: string };

type Action =
  | { type: 'pick-file'; file: File }
  | { type: 'consent-required'; file: File; reason: ConsentRequiredReason }
  | { type: 'prepared'; input: PreparedInput }
  | {
      type: 'classified';
      input: PreparedInput;
      classification: DocumentClassification;
      uncertain: boolean;
    }
  | { type: 'classification-confirmed' }
  | {
      type: 'extracted';
      drafts: ExtractedDrafts;
    }
  | { type: 'set-selection'; selection: DraftSelection }
  | { type: 'edit-observation'; index: number; patch: Partial<ObservationDraft> }
  | { type: 'edit-lab-value'; index: number; patch: Partial<LabValueDraft> }
  | { type: 'edit-supplement'; index: number; patch: Partial<SupplementDraft> }
  | { type: 'edit-open-point'; index: number; patch: Partial<OpenPointDraft> }
  | { type: 'committing-start' }
  | { type: 'committed'; result: CommitResult }
  | { type: 'error'; error: ImportSessionError }
  | { type: 'reset' };

function defaultSelection(drafts: ExtractedDrafts): DraftSelection {
  return {
    observations: drafts.observations.map((_, i) => i),
    labValues: drafts.labValues.map((_, i) => i),
    supplements: drafts.supplements.map((_, i) => i),
    openPoints: drafts.openPoints.map((_, i) => i),
  };
}

function reducer(state: ImportSessionState, action: Action): ImportSessionState {
  switch (action.type) {
    case 'pick-file':
      return { kind: 'preparing', file: action.file };
    case 'consent-required':
      return { kind: 'consent-prompt', file: action.file, reason: action.reason };
    case 'prepared':
      return { kind: 'classifying', input: action.input };
    case 'classified':
      if (action.uncertain) {
        return {
          kind: 'classification-confirm',
          input: action.input,
          classification: action.classification,
        };
      }
      return {
        kind: 'extracting',
        input: action.input,
        classification: action.classification,
      };
    case 'classification-confirmed':
      if (state.kind !== 'classification-confirm') return state;
      return {
        kind: 'extracting',
        input: state.input,
        classification: state.classification,
      };
    case 'extracted':
      if (state.kind !== 'extracting') return state;
      return {
        kind: 'reviewing',
        input: state.input,
        classification: state.classification,
        drafts: action.drafts,
        selection: defaultSelection(action.drafts),
      };
    case 'set-selection':
      if (state.kind !== 'reviewing') return state;
      return { ...state, selection: action.selection };
    case 'edit-observation':
      if (state.kind !== 'reviewing') return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          observations: replaceAt(state.drafts.observations, action.index, action.patch),
        },
      };
    case 'edit-lab-value':
      if (state.kind !== 'reviewing') return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          labValues: replaceAt(state.drafts.labValues, action.index, action.patch),
        },
      };
    case 'edit-supplement':
      if (state.kind !== 'reviewing') return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          supplements: replaceAt(state.drafts.supplements, action.index, action.patch),
        },
      };
    case 'edit-open-point':
      if (state.kind !== 'reviewing') return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          openPoints: replaceAt(state.drafts.openPoints, action.index, action.patch),
        },
      };
    case 'committing-start':
      if (state.kind !== 'reviewing') return state;
      return {
        kind: 'committing',
        input: state.input,
        classification: state.classification,
        drafts: state.drafts,
        selection: state.selection,
      };
    case 'committed':
      return { kind: 'done', result: action.result };
    case 'error':
      return { kind: 'error', error: action.error };
    case 'reset':
      return { kind: 'idle' };
  }
}

function replaceAt<T extends object>(list: readonly T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export interface UseImportSessionOptions {
  /** Test override for the underlying pipeline functions. */
  pipeline?: {
    prepare?: typeof prepare;
    prepareWithConsent?: typeof prepareWithConsent;
    classifyDocument?: typeof classifyDocument;
    extractEntries?: typeof extractEntries;
    commitDrafts?: typeof commitDrafts;
  };
}

export interface UseImportSessionResult {
  state: ImportSessionState;
  pickFile: (file: File) => Promise<void>;
  grantConsent: (rememberForSession: boolean) => Promise<void>;
  declineConsent: () => void;
  confirmClassification: () => Promise<void>;
  rejectClassification: () => void;
  setSelection: (selection: DraftSelection) => void;
  editObservation: (index: number, patch: Partial<ObservationDraft>) => void;
  editLabValue: (index: number, patch: Partial<LabValueDraft>) => void;
  editSupplement: (index: number, patch: Partial<SupplementDraft>) => void;
  editOpenPoint: (index: number, patch: Partial<OpenPointDraft>) => void;
  commit: (commitOptions: CommitOptions) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  retry: () => Promise<void>;
}

/**
 * Drives the IMP-04 import session. Owns the source file reference,
 * the AbortController for in-flight pipeline calls, and the reducer
 * state. Consumers (modal renderer + sub-views) read `state.kind` to
 * decide what to render.
 *
 * Cancellation: `cancel()` aborts the in-flight signal and resets to
 * idle. Used for explicit close + Escape key + dialog backdrop click.
 */
export function useImportSession(options: UseImportSessionOptions = {}): UseImportSessionResult {
  const [state, dispatch] = useReducer(reducer, { kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const pipeline = useMemo(
    () => ({
      prepare: options.pipeline?.prepare ?? prepare,
      prepareWithConsent: options.pipeline?.prepareWithConsent ?? prepareWithConsent,
      classifyDocument: options.pipeline?.classifyDocument ?? classifyDocument,
      extractEntries: options.pipeline?.extractEntries ?? extractEntries,
      commitDrafts: options.pipeline?.commitDrafts ?? commitDrafts,
    }),
    [options.pipeline],
  );

  const startSignal = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller.signal;
  }, []);

  const stopSignal = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runExtract = useCallback(
    async (input: PreparedInput, classification: DocumentClassification): Promise<void> => {
      const signal = startSignal();
      try {
        const drafts = await pipeline.extractEntries(input, classification, { signal });
        if (signal.aborted) return;
        dispatch({ type: 'extracted', drafts });
      } catch (err) {
        if (isAbortError(err)) return;
        if (err instanceof AiCallError) {
          dispatch({ type: 'error', error: { kind: 'ai', ai: err } });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'error', error: { kind: 'prepare', message } });
      }
    },
    [pipeline, startSignal],
  );

  const runClassify = useCallback(
    async (input: PreparedInput): Promise<void> => {
      dispatch({ type: 'prepared', input });
      const signal = startSignal();
      try {
        const { classification, uncertain } = await pipeline.classifyDocument(input, {
          signal,
        });
        if (signal.aborted) return;
        dispatch({ type: 'classified', input, classification, uncertain });
        if (!uncertain) {
          await runExtract(input, classification);
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (err instanceof AiCallError) {
          dispatch({ type: 'error', error: { kind: 'ai', ai: err } });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'error', error: { kind: 'prepare', message } });
      }
    },
    [pipeline, startSignal, runExtract],
  );

  const runPrepare = useCallback(
    async (file: File): Promise<void> => {
      try {
        const result = await pipeline.prepare(file);
        if (result.kind === 'consent-required') {
          pendingFileRef.current = result.file;
          dispatch({
            type: 'consent-required',
            file: result.file,
            reason: result.reason,
          });
          return;
        }
        await runClassify(result.input);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'error', error: { kind: 'prepare', message } });
      }
    },
    [pipeline, runClassify],
  );

  const pickFile = useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      pendingFileRef.current = null;
      dispatch({ type: 'pick-file', file });
      await runPrepare(file);
    },
    [runPrepare],
  );

  const grantConsent = useCallback(
    async (rememberForSession: boolean) => {
      const file = pendingFileRef.current;
      if (!file) return;
      dispatch({ type: 'pick-file', file });
      try {
        const result = await pipeline.prepareWithConsent(file, { rememberForSession });
        if (result.kind === 'consent-declined') {
          stopSignal();
          dispatch({ type: 'reset' });
          pendingFileRef.current = null;
          return;
        }
        await runClassify(result.input);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'error', error: { kind: 'prepare', message } });
      }
    },
    [pipeline, runClassify, stopSignal],
  );

  const declineConsent = useCallback(() => {
    pendingFileRef.current = null;
    lastFileRef.current = null;
    stopSignal();
    dispatch({ type: 'reset' });
  }, [stopSignal]);

  const confirmClassification = useCallback(async () => {
    if (state.kind !== 'classification-confirm') return;
    const { input, classification } = state;
    dispatch({ type: 'classification-confirmed' });
    await runExtract(input, classification);
  }, [state, runExtract]);

  const rejectClassification = useCallback(() => {
    stopSignal();
    pendingFileRef.current = null;
    lastFileRef.current = null;
    dispatch({ type: 'reset' });
  }, [stopSignal]);

  const setSelection = useCallback((selection: DraftSelection) => {
    dispatch({ type: 'set-selection', selection });
  }, []);

  const editObservation = useCallback((index: number, patch: Partial<ObservationDraft>) => {
    dispatch({ type: 'edit-observation', index, patch });
  }, []);

  const editLabValue = useCallback((index: number, patch: Partial<LabValueDraft>) => {
    dispatch({ type: 'edit-lab-value', index, patch });
  }, []);

  const editSupplement = useCallback((index: number, patch: Partial<SupplementDraft>) => {
    dispatch({ type: 'edit-supplement', index, patch });
  }, []);

  const editOpenPoint = useCallback((index: number, patch: Partial<OpenPointDraft>) => {
    dispatch({ type: 'edit-open-point', index, patch });
  }, []);

  const commit = useCallback(
    async (commitOptions: CommitOptions) => {
      if (state.kind !== 'reviewing') return;
      const { drafts, selection } = state;
      dispatch({ type: 'committing-start' });
      try {
        const result = await pipeline.commitDrafts(drafts, selection, commitOptions);
        dispatch({ type: 'committed', result });
        // Drop the in-memory file reference on terminal success.
        pendingFileRef.current = null;
        lastFileRef.current = null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'error', error: { kind: 'commit', message } });
      }
    },
    [pipeline, state],
  );

  const cancel = useCallback(() => {
    stopSignal();
    pendingFileRef.current = null;
    lastFileRef.current = null;
    dispatch({ type: 'reset' });
  }, [stopSignal]);

  const reset = useCallback(() => {
    pendingFileRef.current = null;
    lastFileRef.current = null;
    dispatch({ type: 'reset' });
  }, []);

  const retry = useCallback(async () => {
    const file = lastFileRef.current;
    if (!file) {
      dispatch({ type: 'reset' });
      return;
    }
    dispatch({ type: 'pick-file', file });
    await runPrepare(file);
  }, [runPrepare]);

  return {
    state,
    pickFile,
    grantConsent,
    declineConsent,
    confirmClassification,
    rejectClassification,
    setSelection,
    editObservation,
    editLabValue,
    editSupplement,
    editOpenPoint,
    commit,
    cancel,
    reset,
    retry,
  };
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

// Re-export for convenience so consumers can import everything from one path.
export { EMPTY_DRAFTS };
export type { CommitOptions, CommitResult, DraftSelection } from './commit';
