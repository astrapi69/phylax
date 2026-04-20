import { Routes, Route, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { EntryRouter } from './EntryRouter';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireProfile } from './RequireProfile';
import { AppShell } from '../features/app-shell';
import { OnboardingFlow, WelcomeView, PrivacyView, SetupView } from '../features/onboarding';
import { UnlockScreen } from '../features/unlock';
import { BackupImportSelectView, BackupImportUnlockView } from '../features/backup-import';
import { ProfileCreateForm } from '../features/profile-create';
import { ProfileView } from '../features/profile-view';
import { ObservationsView } from '../features/observations';
import { LabValuesView } from '../features/lab-values';
import { SupplementsView } from '../features/supplements';
import { OpenPointsView } from '../features/open-points';
import { TimelineView } from '../features/timeline';
import { DocumentsPlaceholder } from '../features/documents/DocumentsPlaceholder';
import { SettingsScreen } from '../features/settings';
import { ImportFlow } from '../features/profile-import/ui';
import { ChatView } from '../features/ai-chat';
import { NotFound } from '../features/not-found/NotFound';

function OnboardingPage() {
  const navigate = useNavigate();
  const handleComplete = useCallback(() => {
    navigate('/profile/create', { replace: true });
  }, [navigate]);
  return <OnboardingFlow onComplete={handleComplete} />;
}

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
 * - /welcome, /privacy, /setup: first-run onboarding flow screens (stubs
 *   in ONB-01a; filled in ONB-01b and ONB-01c).
 * - /backup/import/select, /backup/import/unlock: encrypted backup
 *   import flow (stubs in ONB-01a; filled in ONB-01e). Distinct from
 *   /import which handles Markdown profile import.
 * - /onboarding retained as safety net until ONB-01c replaces the old
 *   OnboardingFlow with SetupView.
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
      <Route path="/welcome" element={<WelcomeView />} />
      <Route path="/privacy" element={<PrivacyView />} />
      <Route path="/setup" element={<SetupView />} />
      <Route path="/backup/import/select" element={<BackupImportSelectView />} />
      <Route path="/backup/import/unlock" element={<BackupImportUnlockView />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/unlock" element={<UnlockScreen />} />

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
        <Route path="/chat" element={<ChatView />} />
        <Route path="/import" element={<ImportFlow />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}
