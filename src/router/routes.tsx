import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '../features/app-shell';
import { OnboardingFlow } from '../features/onboarding';
import { UnlockScreen } from '../features/unlock';
import { ProfilePlaceholder } from '../features/profile/ProfilePlaceholder';
import { ObservationsPlaceholder } from '../features/observations/ObservationsPlaceholder';
import { LabValuesPlaceholder } from '../features/lab-values/LabValuesPlaceholder';
import { DocumentsPlaceholder } from '../features/documents/DocumentsPlaceholder';
import { SettingsPlaceholder } from '../features/settings/SettingsPlaceholder';
import { NotFound } from '../features/not-found/NotFound';

function OnboardingPage() {
  const navigate = useNavigate();
  const handleComplete = useCallback(() => {
    navigate('/profile', { replace: true });
  }, [navigate]);
  return <OnboardingFlow onComplete={handleComplete} />;
}

/**
 * Application route tree.
 *
 * - /onboarding and /unlock are full-screen (no app shell)
 * - All other routes are protected and wrapped in AppShell
 * - / redirects to /profile
 * - Unknown routes show 404
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Full-screen routes (no shell) */}
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/unlock" element={<UnlockScreen />} />

      {/* Protected routes with app shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/profile" replace />} />
        <Route path="/profile" element={<ProfilePlaceholder />} />
        <Route path="/observations" element={<ObservationsPlaceholder />} />
        <Route path="/lab-values" element={<LabValuesPlaceholder />} />
        <Route path="/documents" element={<DocumentsPlaceholder />} />
        <Route path="/settings" element={<SettingsPlaceholder />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
