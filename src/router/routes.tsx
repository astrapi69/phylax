import { Routes, Route, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { EntryRouter } from './EntryRouter';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireProfile } from './RequireProfile';
import { SetupFlowGuard } from './SetupFlowGuard';
import { AppShell } from '../features/app-shell';
import { WelcomeView, PrivacyView, SetupView } from '../features/onboarding';
import { UnlockView } from '../features/unlock';
import { BackupImportSelectView, BackupImportUnlockView } from '../features/backup-import';
import { ProfileCreateForm } from '../features/profile-create';
import { ProfileView } from '../features/profile-view';
import { ObservationsView } from '../features/observations';
import { LabValuesView } from '../features/lab-values';
import { SupplementsView } from '../features/supplements';
import { OpenPointsView } from '../features/open-points';
import { TimelineView } from '../features/timeline';
import { DocumentsPlaceholder } from '../features/documents/DocumentsPlaceholder';
import { DocumentViewer } from '../features/documents/DocumentViewer';
import { SettingsScreen } from '../features/settings';
import { ImportFlow } from '../features/profile-import/ui';
import { ChatView } from '../features/ai-chat';
import { LicenseView } from '../features/legal';
import { NotFound } from '../features/not-found/NotFound';

function ProfileCreatePage() {
  const navigate = useNavigate();
  const handleComplete = useCallback(() => {
    navigate('/profile', { replace: true });
  }, [navigate]);
  return <ProfileCreateForm onComplete={handleComplete} />;
}

/**
 * Application route tree.
 *
 * - `/` mounts EntryRouter: picks /welcome, /unlock, or /profile based
 *   on vault + keystore state (ONB-01a).
 * - /welcome, /privacy, /setup: first-run onboarding flow screens
 *   (ONB-01b/c). SetupView owns the meta-row write and then navigates
 *   to /profile/create. Wrapped in SetupFlowGuard (TD-05): a direct
 *   visit with an existing vault redirects to /unlock instead of
 *   letting useSetupVault.runSetup() overwrite meta.
 * - /backup/import/select, /backup/import/unlock: encrypted backup
 *   import flow (stubs in ONB-01a; filled in ONB-01e). Distinct from
 *   /import which handles Markdown profile import.
 * - All full-screen routes (above) render without the app shell.
 * - /profile/create is protected but does NOT require an existing profile.
 * - Feature routes are protected AND require a profile.
 * - Unknown routes show 404 (protected, inside shell).
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Entry decision: picks destination based on vault + lock state */}
      <Route path="/" element={<EntryRouter />} />

      {/* Full-screen routes (no shell) */}
      {/* Setup flow: SetupFlowGuard redirects locked users to /unlock and
          unlocked users to /profile when a vault exists (TD-07); no-vault
          users render the setup flow. */}
      <Route element={<SetupFlowGuard />}>
        <Route path="/welcome" element={<WelcomeView />} />
        <Route path="/privacy" element={<PrivacyView />} />
        <Route path="/setup" element={<SetupView />} />
      </Route>
      <Route path="/backup/import/select" element={<BackupImportSelectView />} />
      <Route path="/backup/import/unlock" element={<BackupImportUnlockView />} />
      <Route path="/unlock" element={<UnlockView />} />

      {/* Protected route: profile creation (no RequireProfile) */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/profile/create" element={<ProfileCreatePage />} />
        {/* Catch-all 404: inside shell but no RequireProfile so it always renders */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Protected routes that require an existing profile */}
      <Route
        element={
          <ProtectedRoute>
            <RequireProfile>
              <AppShell />
            </RequireProfile>
          </ProtectedRoute>
        }
      >
        <Route path="/profile" element={<ProfileView />} />
        <Route path="/observations" element={<ObservationsView />} />
        <Route path="/lab-values" element={<LabValuesView />} />
        <Route path="/supplements" element={<SupplementsView />} />
        <Route path="/open-points" element={<OpenPointsView />} />
        <Route path="/timeline" element={<TimelineView />} />
        <Route path="/documents" element={<DocumentsPlaceholder />} />
        <Route path="/documents/:id" element={<DocumentViewer />} />
        <Route path="/chat" element={<ChatView />} />
        <Route path="/import" element={<ImportFlow />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/license" element={<LicenseView />} />
      </Route>
    </Routes>
  );
}
