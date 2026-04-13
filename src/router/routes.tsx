import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireProfile } from './RequireProfile';
import { AppShell } from '../features/app-shell';
import { OnboardingFlow } from '../features/onboarding';
import { UnlockScreen } from '../features/unlock';
import { ProfileCreateForm } from '../features/profile-create';
import { ProfilePlaceholder } from '../features/profile/ProfilePlaceholder';
import { ObservationsPlaceholder } from '../features/observations/ObservationsPlaceholder';
import { LabValuesPlaceholder } from '../features/lab-values/LabValuesPlaceholder';
import { DocumentsPlaceholder } from '../features/documents/DocumentsPlaceholder';
import { SettingsPlaceholder } from '../features/settings/SettingsPlaceholder';
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
 * - /onboarding and /unlock are full-screen (no app shell)
 * - /profile/create is protected but does NOT require an existing profile
 * - Feature routes are protected AND require a profile
 * - / redirects to /profile
 * - Unknown routes show 404 (protected, inside shell)
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Full-screen routes (no shell) */}
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
        <Route index element={<Navigate to="/profile" replace />} />
        <Route path="/profile" element={<ProfilePlaceholder />} />
        <Route path="/observations" element={<ObservationsPlaceholder />} />
        <Route path="/lab-values" element={<LabValuesPlaceholder />} />
        <Route path="/documents" element={<DocumentsPlaceholder />} />
        <Route path="/settings" element={<SettingsPlaceholder />} />
      </Route>
    </Routes>
  );
}
