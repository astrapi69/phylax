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
  resolvePerTypeMode,
  type EntityCounts,
  type ImportResult,
  type PerTypeMode,
} from './types';
import {
  detectMergeConflicts,
  hasAnyConflict,
  type MergeConflictSet,
} from './detectMergeConflicts';
import type { MergeResolutions } from '../../../domain/import-merge';

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
  | {
      kind: 'preview';
      parseResult: ParseResult;
      targetProfileId: string;
      /**
       * IM-05 selection from the confirm-replace dialog. Undefined when
       * preview was reached on an empty target (no dialog shown); in that
       * case the import passes legacy `replaceExisting: true` since per-type
       * deletes are no-ops on an empty target.
       */
      replaceSelection?: PerTypeMode;
    }
  | {
      kind: 'confirm-replace';
      parseResult: ParseResult;
      targetProfileId: string;
      existingCounts: EntityCounts;
    }
  | {
      kind: 'conflict-resolution';
      parseResult: ParseResult;
      targetProfileId: string;
      replaceSelection: PerTypeMode;
      conflicts: MergeConflictSet;
    }
  | {
      kind: 'importing';
      parseResult: ParseResult;
      targetProfileId: string;
      replaceSelection?: PerTypeMode;
      resolutions?: MergeResolutions;
    }
  | { kind: 'done'; importResult: ImportResult }
  | { kind: 'error'; detail: string };

export interface ImportHook {
  state: ImportState;
  loadMarkdown: (markdown: string) => Promise<void>;
  selectProfile: (targetProfileId: string) => Promise<void>;
  confirmReplace: (selection: PerTypeMode) => void;
  startImport: () => Promise<void>;
  /**
   * IM-06: from `'conflict-resolution'` state, supply the user-
   * collected resolutions for every detected conflict and proceed
   * to `'importing'`. Caller must pass an entry for every conflict
   * in `state.conflicts`; missing entries surface
   * `UnresolvedConflictError` from `importProfile` and route to
   * `'error'`. Q2 discipline: the UI gates the submit button until
   * every conflict has a pick.
   */
  submitResolutions: (resolutions: MergeResolutions) => Promise<void>;
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
 * Full state graph (post-IM-06):
 *
 *   entry
 *     -> parsing                                 (loadMarkdown)
 *     -> parse-failure                            (parser low-confidence)
 *     -> profile-selection
 *
 *   parse-failure
 *     -> parse-failure(cleanup-loading)           (requestAICleanup)
 *     -> parse-failure(cleanup-error)
 *     -> parse-failure(cleanup-impossible)
 *     -> profile-selection                        (proceedWithPartial)
 *
 *   profile-selection
 *     -> preview                                  (target empty)
 *     -> confirm-replace                          (target non-empty)
 *
 *   confirm-replace
 *     -> preview                                  (confirmReplace)
 *
 *   preview
 *     -> importing                                (startImport, no merge mode)
 *     -> conflict-resolution                      (startImport, merge mode + conflicts)
 *     -> importing                                (startImport, merge mode + zero conflicts)
 *     -> confirm-replace                          (startImport, ImportTargetNotEmptyError fallback)
 *
 *   conflict-resolution                           [IM-06 Step 4]
 *     -> importing                                (submitResolutions)
 *     -> entry                                    (cancel; W3 atomicity)
 *
 *   importing
 *     -> done
 *     -> error                                    (any other error)
 *
 *   any -> entry                                  (cancel / reset)
 *
 * All async edges catch errors and transition to `'error'` with a
 * user-facing message. `startImport` catches `ImportTargetNotEmptyError`
 * specifically and routes to `'confirm-replace'` instead of failing.
 *
 * Atomicity guarantees:
 *
 * - Pre-transaction conflict detection (`detectMergeConflicts`) runs
 *   BEFORE any Dexie write. Errors there route to `'error'` (W4: only
 *   user-decision conflicts surface as `'conflict-resolution'`).
 * - Cancel from `'conflict-resolution'` returns to `'entry'`. No
 *   transaction was opened; vault stays untouched (W3).
 * - `submitResolutions` calls `importProfile` with the collected
 *   resolutions; an `UnresolvedConflictError` (UI bug) surfaces as
 *   `'error'`.
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
      setState({ kind: 'error', detail: toDetail(err) });
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
        setState({ kind: 'error', detail: toDetail(err) });
      }
    },
    [state],
  );

  const confirmReplace = useCallback(
    (selection: PerTypeMode): void => {
      if (state.kind !== 'confirm-replace') return;
      setState({
        kind: 'preview',
        parseResult: state.parseResult,
        targetProfileId: state.targetProfileId,
        replaceSelection: selection,
      });
    },
    [state],
  );

  const startImport = useCallback(async (): Promise<void> => {
    if (state.kind !== 'preview') return;
    const { parseResult, targetProfileId, replaceSelection } = state;

    // IM-06: pre-transaction conflict detection. If the user picked
    // 'merge' for any type and at least one row in that type would
    // surface as a conflict, route through 'conflict-resolution' so
    // the UI collects picks before the Dexie write opens. Types
    // without merge mode are skipped (their resolution is implicit:
    // replace / add / skip).
    if (replaceSelection) {
      const modeMap = resolvePerTypeMode(replaceSelection);
      const anyMerge =
        modeMap.observations === 'merge' ||
        modeMap.labData === 'merge' ||
        modeMap.supplements === 'merge' ||
        modeMap.openPoints === 'merge' ||
        modeMap.profileVersions === 'merge' ||
        modeMap.timelineEntries === 'merge';
      if (anyMerge) {
        let conflicts: MergeConflictSet;
        try {
          conflicts = await detectMergeConflicts(parseResult, targetProfileId, modeMap);
        } catch (err) {
          // W4: pre-transaction errors (decryption / load failure)
          // route to 'error', NOT 'conflict-resolution'.
          setState({ kind: 'error', detail: toDetail(err) });
          return;
        }
        if (hasAnyConflict(conflicts)) {
          setState({
            kind: 'conflict-resolution',
            parseResult,
            targetProfileId,
            replaceSelection,
            conflicts,
          });
          return;
        }
        // Zero conflicts -> skip resolution, proceed straight to
        // importing with empty resolutions.
      }
    }

    setState({ kind: 'importing', parseResult, targetProfileId, replaceSelection });
    try {
      const importResult = await importProfile(parseResult, targetProfileId, {
        replaceExisting: replaceSelection ?? true,
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
      setState({ kind: 'error', detail: toDetail(err) });
    }
  }, [state]);

  const submitResolutions = useCallback(
    async (resolutions: MergeResolutions): Promise<void> => {
      if (state.kind !== 'conflict-resolution') return;
      const { parseResult, targetProfileId, replaceSelection } = state;
      setState({
        kind: 'importing',
        parseResult,
        targetProfileId,
        replaceSelection,
        resolutions,
      });
      try {
        const importResult = await importProfile(parseResult, targetProfileId, {
          replaceExisting: replaceSelection,
          resolutions,
        });
        setState({ kind: 'done', importResult });
      } catch (err) {
        // UnresolvedConflictError from importProfile means the UI
        // submitted incomplete resolutions (Q2 discipline broken).
        // Route through the standard error surface; the screen can
        // display the message and the user can retry.
        setState({ kind: 'error', detail: toDetail(err) });
      }
    },
    [state],
  );

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
    submitResolutions,
    requestAICleanup,
    proceedWithPartial,
    cancel,
    reset,
  };
}

function toDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unbekannter Fehler';
}
