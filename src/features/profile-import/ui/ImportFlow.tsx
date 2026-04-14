import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDisplayName } from '../../../domain';
import type { Profile } from '../../../domain';
import { ProfileRepository } from '../../../db/repositories';
import { useImport } from '../import';
import { ImportEntryScreen } from './ImportEntryScreen';
import { ProfileSelectionScreen } from './ProfileSelectionScreen';
import { PreviewScreen } from './PreviewScreen';
import { ConfirmDialog } from './ConfirmDialog';
import { ResultScreen } from './ResultScreen';

/**
 * Orchestrator for the import flow. Renders one screen per state kind.
 *
 * Local state held outside the hook:
 * - sourceLabel: "filename" vs "Eingefügter Text" for preview display.
 *   The hook does not need to know the source.
 * - profilesById: cached for display-name lookups in preview/confirm/done.
 */
export function ImportFlow() {
  const navigate = useNavigate();
  const importState = useImport();
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const reloadProfilesRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const repo = new ProfileRepository();
      const list = await repo.list();
      if (cancelled) return;
      setProfilesById(Object.fromEntries(list.map((p) => [p.id, p])));
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
    return p ? getDisplayName(p) : 'Zielprofil';
  };

  const state = importState.state;

  switch (state.kind) {
    case 'entry':
      return <ImportEntryScreen onSubmit={handleEntrySubmit} onCancel={handleNavigateHome} />;

    case 'parsing':
      return (
        <div role="status" aria-live="polite" className="text-sm text-gray-700 dark:text-gray-300">
          Markdown wird verarbeitet...
        </div>
      );

    case 'profile-selection':
      return (
        <ProfileSelectionScreen onSelect={handleProfileSelect} onCancel={importState.cancel} />
      );

    case 'preview':
      return (
        <PreviewScreen
          parseResult={state.parseResult}
          sourceLabel={sourceLabel || 'Unbekannt'}
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
            sourceLabel={sourceLabel || 'Unbekannt'}
            targetProfileName={targetName(state.targetProfileId)}
            onConfirm={() => {
              /* blocked by modal */
            }}
            onBack={importState.cancel}
          />
          <ConfirmDialog
            existingCounts={state.existingCounts}
            targetProfileName={targetName(state.targetProfileId)}
            onConfirm={importState.confirmReplace}
            onCancel={importState.cancel}
          />
        </>
      );

    case 'importing':
      return (
        <div role="status" aria-live="polite" className="text-sm text-gray-700 dark:text-gray-300">
          Daten werden importiert...
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
          outcome={{ kind: 'failure', message: state.message }}
          onNavigateHome={handleNavigateHome}
          onRestart={importState.reset}
        />
      );
  }
}
