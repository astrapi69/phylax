import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDisplayName } from '../../../domain';
import type { Profile } from '../../../domain';
import { ProfileRepository } from '../../../db/repositories';
import { useImport, EMPTY_COUNTS, type EntityCounts } from '../import';
import type { ParseResult } from '../parser/types';
import { ImportCleanupScreen } from '../ai-fallback';
import { ImportEntryScreen } from './ImportEntryScreen';
import { ProfileSelectionScreen } from './ProfileSelectionScreen';
import { PreviewScreen } from './PreviewScreen';
import { ConfirmDialog } from './ConfirmDialog';
import { ResultScreen } from './ResultScreen';

/**
 * IM-05 Option B: derive an EntityCounts shape from a ParseResult
 * for the ConfirmDialog. Mirrors how `countEntities` reports the
 * existing rows so the dialog can render rows with both sides of
 * the picture (existing + parsed) and gate available modes.
 */
function parsedCountsFromResult(parseResult: ParseResult): EntityCounts {
  return {
    ...EMPTY_COUNTS,
    observations: parseResult.observations.length,
    labReports: parseResult.labReports.length,
    labValues: parseResult.labValues.length,
    supplements: parseResult.supplements.length,
    openPoints: parseResult.openPoints.length,
    profileVersions: parseResult.profileVersions.length,
    timelineEntries: parseResult.timelineEntries.length,
  };
}

/**
 * Orchestrator for the import flow. Renders one screen per state kind.
 *
 * Local state held outside the hook:
 * - sourceLabel: "filename" vs "Eingefuegter Text" for preview display.
 *   The hook does not need to know the source.
 * - profilesById: cached for display-name lookups in preview/confirm/done.
 */
export function ImportFlow() {
  const { t } = useTranslation('import');
  const navigate = useNavigate();
  const importState = useImport();
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const reloadProfilesRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const repo = new ProfileRepository();
      try {
        const list = await repo.list();
        if (cancelled) return;
        setProfilesById(Object.fromEntries(list.map((p) => [p.id, p])));
      } catch (err) {
        // Bootstrap read: the repo can fail mid-await when the keystore
        // is locked during test teardown or an auto-lock race. Swallow
        // unconditionally - a failed read leaves `profilesById` empty,
        // which the ProfileSelectionScreen already handles. Explicit
        // reloads via reloadProfilesRef use the same load() and so are
        // equally defensive. Never throw here; `void load()` at mount
        // would otherwise become an unhandled rejection.
        if (cancelled) return;
        console.warn('[ImportFlow] profile list load failed', err);
      }
    }
    reloadProfilesRef.current = async () => {
      await load();
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEntrySubmit = useCallback(
    (content: string, label: string) => {
      setSourceLabel(label);
      void importState.loadMarkdown(content);
    },
    [importState],
  );

  const handleNavigateHome = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  const handleProfileSelect = useCallback(
    async (profileId: string) => {
      // When the user just created a new profile, refresh the cache so
      // subsequent screens can resolve its display name.
      await reloadProfilesRef.current();
      await importState.selectProfile(profileId);
    },
    [importState],
  );

  const targetName = (profileId: string): string => {
    const p = profilesById[profileId];
    return p ? getDisplayName(p) : t('flow.target-fallback');
  };

  const state = importState.state;

  switch (state.kind) {
    case 'entry':
      return <ImportEntryScreen onSubmit={handleEntrySubmit} onCancel={handleNavigateHome} />;

    case 'parsing':
      return (
        <div role="status" aria-live="polite" className="text-sm text-gray-700 dark:text-gray-300">
          {t('flow.parsing')}
        </div>
      );

    case 'profile-selection':
      return (
        <ProfileSelectionScreen onSelect={handleProfileSelect} onCancel={importState.cancel} />
      );

    case 'parse-failure':
      return (
        <ImportCleanupScreen
          parseResult={state.parseResult}
          cleanup={state.cleanup}
          onRequestCleanup={() => void importState.requestAICleanup()}
          onProceedWithPartial={importState.proceedWithPartial}
          onRestart={importState.reset}
          onNavigateSettings={() => navigate('/settings')}
        />
      );

    case 'preview':
      return (
        <PreviewScreen
          parseResult={state.parseResult}
          sourceLabel={sourceLabel || t('flow.source-unknown')}
          targetProfileName={targetName(state.targetProfileId)}
          onConfirm={importState.startImport}
          onBack={importState.cancel}
        />
      );

    case 'confirm-replace':
      return (
        <>
          <PreviewScreen
            parseResult={state.parseResult}
            sourceLabel={sourceLabel || t('flow.source-unknown')}
            targetProfileName={targetName(state.targetProfileId)}
            onConfirm={() => {
              /* blocked by modal */
            }}
            onBack={importState.cancel}
          />
          <ConfirmDialog
            existingCounts={state.existingCounts}
            parsedCounts={parsedCountsFromResult(state.parseResult)}
            targetProfileName={targetName(state.targetProfileId)}
            onConfirm={importState.confirmReplace}
            onCancel={importState.cancel}
          />
        </>
      );

    case 'importing':
      return (
        <div role="status" aria-live="polite" className="text-sm text-gray-700 dark:text-gray-300">
          {t('flow.importing')}
        </div>
      );

    case 'done':
      return (
        <ResultScreen
          outcome={{
            kind: 'success',
            importResult: state.importResult,
            targetProfileName: targetName(state.importResult.targetProfileId),
          }}
          onNavigateHome={handleNavigateHome}
          onRestart={importState.reset}
        />
      );

    case 'error':
      return (
        <ResultScreen
          outcome={{ kind: 'failure', detail: state.detail }}
          onNavigateHome={handleNavigateHome}
          onRestart={importState.reset}
        />
      );
  }
}
