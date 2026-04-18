import { useCallback, useState } from 'react';
import { parseProfile } from '../parser/parseProfile';
import type { ParseResult } from '../parser/types';
import {
  isEmptyParseResult,
  requestCleanup,
  shouldOfferCleanup,
  type CleanupSubState,
} from '../ai-fallback';
import { countEntities } from './countEntities';
import { importProfile } from './importProfile';
import {
  ImportTargetNotEmptyError,
  countsAreEmpty,
  type EntityCounts,
  type ImportResult,
} from './types';

export type ImportState =
  | { kind: 'entry' }
  | { kind: 'parsing'; source: string }
  | { kind: 'profile-selection'; parseResult: ParseResult }
  | {
      kind: 'parse-failure';
      originalMarkdown: string;
      parseResult: ParseResult;
      cleanup: CleanupSubState;
    }
  | { kind: 'preview'; parseResult: ParseResult; targetProfileId: string }
  | {
      kind: 'confirm-replace';
      parseResult: ParseResult;
      targetProfileId: string;
      existingCounts: EntityCounts;
    }
  | { kind: 'importing'; parseResult: ParseResult; targetProfileId: string }
  | { kind: 'done'; importResult: ImportResult }
  | { kind: 'error'; message: string };

export interface ImportHook {
  state: ImportState;
  loadMarkdown: (markdown: string) => Promise<void>;
  selectProfile: (targetProfileId: string) => Promise<void>;
  confirmReplace: () => void;
  startImport: () => Promise<void>;
  /**
   * Trigger AI-09 cleanup on a parse-failure state. Reads the original
   * markdown, sends it to Anthropic with the cleanup system prompt, and
   * routes the result: successful re-parse transitions to profile-selection,
   * other outcomes update the cleanup sub-state in place so the screen
   * can render the right message.
   */
  requestAICleanup: () => Promise<void>;
  /**
   * From a soft-failure parse-failure state, accept the partial parse
   * result and continue to profile selection. No-op on empty results.
   */
  proceedWithPartial: () => void;
  cancel: () => void;
  reset: () => void;
}

/**
 * State machine for the Markdown profile import flow.
 *
 * Transitions (happy path):
 *   entry -> parsing -> profile-selection -> preview -> importing -> done
 *
 * Non-empty target routes through confirm-replace between
 * profile-selection and preview. Errors at any step land in `error`.
 * `cancel` and `reset` return to `entry` for a fresh start.
 *
 * All async edges catch errors and transition to `error` with a
 * user-facing message. `startImport` catches `ImportTargetNotEmptyError`
 * specifically and routes to `confirm-replace` instead of failing.
 */
export function useImport(): ImportHook {
  const [state, setState] = useState<ImportState>({ kind: 'entry' });

  const loadMarkdown = useCallback(async (markdown: string): Promise<void> => {
    setState({ kind: 'parsing', source: markdown });
    try {
      // Parser is synchronous; the await keeps the call site ergonomic
      // and gives React a tick to render the parsing state.
      const parseResult = await Promise.resolve(parseProfile(markdown));
      if (shouldOfferCleanup(parseResult)) {
        setState({
          kind: 'parse-failure',
          originalMarkdown: markdown,
          parseResult,
          cleanup: { kind: 'idle' },
        });
        return;
      }
      setState({ kind: 'profile-selection', parseResult });
    } catch (err) {
      setState({ kind: 'error', message: toMessage(err) });
    }
    // Stryker disable next-line ArrayDeclaration: React dep array; changing [] to non-empty affects render frequency, not behavior
  }, []);

  const selectProfile = useCallback(
    async (targetProfileId: string): Promise<void> => {
      if (state.kind !== 'profile-selection') return;
      const parseResult = state.parseResult;
      try {
        const existingCounts = await countEntities(targetProfileId);
        if (countsAreEmpty(existingCounts)) {
          setState({ kind: 'preview', parseResult, targetProfileId });
        } else {
          setState({
            kind: 'confirm-replace',
            parseResult,
            targetProfileId,
            existingCounts,
          });
        }
      } catch (err) {
        setState({ kind: 'error', message: toMessage(err) });
      }
    },
    [state],
  );

  const confirmReplace = useCallback((): void => {
    if (state.kind !== 'confirm-replace') return;
    setState({
      kind: 'preview',
      parseResult: state.parseResult,
      targetProfileId: state.targetProfileId,
    });
  }, [state]);

  const startImport = useCallback(async (): Promise<void> => {
    if (state.kind !== 'preview') return;
    const { parseResult, targetProfileId } = state;
    setState({ kind: 'importing', parseResult, targetProfileId });
    try {
      const importResult = await importProfile(parseResult, targetProfileId, {
        replaceExisting: true,
      });
      setState({ kind: 'done', importResult });
    } catch (err) {
      if (err instanceof ImportTargetNotEmptyError) {
        setState({
          kind: 'confirm-replace',
          parseResult,
          targetProfileId,
          existingCounts: err.existingCounts,
        });
        return;
      }
      setState({ kind: 'error', message: toMessage(err) });
    }
  }, [state]);

  const requestAICleanup = useCallback(async (): Promise<void> => {
    if (state.kind !== 'parse-failure') return;
    const { originalMarkdown, parseResult } = state;
    setState({
      kind: 'parse-failure',
      originalMarkdown,
      parseResult,
      cleanup: { kind: 'loading' },
    });

    const result = await requestCleanup(originalMarkdown);

    if (result.kind === 'not-configured' || result.kind === 'error') {
      // not-configured should not happen here because the UI only shows
      // the button when configured; route it through the same error banner
      // defensively.
      const error =
        result.kind === 'error'
          ? result.error
          : ({ kind: 'unknown', message: 'KI nicht konfiguriert.' } as const);
      setState({
        kind: 'parse-failure',
        originalMarkdown,
        parseResult,
        cleanup: { kind: 'error', error },
      });
      return;
    }
    if (result.kind === 'impossible') {
      setState({
        kind: 'parse-failure',
        originalMarkdown,
        parseResult,
        cleanup: { kind: 'impossible' },
      });
      return;
    }

    const reparsed = parseProfile(result.cleaned);
    if (isEmptyParseResult(reparsed)) {
      setState({
        kind: 'parse-failure',
        originalMarkdown,
        parseResult,
        cleanup: { kind: 'parse-failed-after-cleanup', rawCleaned: result.cleaned },
      });
      return;
    }
    setState({ kind: 'profile-selection', parseResult: reparsed });
  }, [state]);

  const proceedWithPartial = useCallback((): void => {
    if (state.kind !== 'parse-failure') return;
    if (isEmptyParseResult(state.parseResult)) return;
    setState({ kind: 'profile-selection', parseResult: state.parseResult });
  }, [state]);

  // Stryker disable next-line ArrayDeclaration: React dep array cosmetic
  const cancel = useCallback((): void => {
    setState({ kind: 'entry' });
  }, []);

  // Stryker disable next-line ArrayDeclaration: React dep array cosmetic
  const reset = useCallback((): void => {
    setState({ kind: 'entry' });
  }, []);

  return {
    state,
    loadMarkdown,
    selectProfile,
    confirmReplace,
    startImport,
    requestAICleanup,
    proceedWithPartial,
    cancel,
    reset,
  };
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unbekannter Fehler beim Import.';
}
