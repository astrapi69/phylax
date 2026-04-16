import { useCallback, useState } from 'react';
import { parseProfile } from '../parser/parseProfile';
import type { ParseResult } from '../parser/types';
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
      if (isEmptyParseResult(parseResult)) {
        setState({
          kind: 'error',
          message:
            'Kein interpretierbarer Inhalt gefunden. Ist die Datei eine Lebende-Gesundheit Markdown-Datei?',
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

  // Stryker disable next-line ArrayDeclaration: React dep array cosmetic
  const cancel = useCallback((): void => {
    setState({ kind: 'entry' });
  }, []);

  // Stryker disable next-line ArrayDeclaration: React dep array cosmetic
  const reset = useCallback((): void => {
    setState({ kind: 'entry' });
  }, []);

  return { state, loadMarkdown, selectProfile, confirmReplace, startImport, cancel, reset };
}

function isEmptyParseResult(r: ParseResult): boolean {
  return (
    r.profile === null &&
    r.observations.length === 0 &&
    r.labReports.length === 0 &&
    r.labValues.length === 0 &&
    r.supplements.length === 0 &&
    r.openPoints.length === 0 &&
    r.profileVersions.length === 0 &&
    r.timelineEntries.length === 0
  );
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unbekannter Fehler beim Import.';
}
