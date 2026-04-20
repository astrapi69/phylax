import { useState, useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProfileRepository } from '../db/repositories/profileRepository';

interface RequireProfileProps {
  children: ReactNode;
}

/**
 * Route wrapper that redirects to /profile/create if no profile exists.
 *
 * Separated from ProtectedRoute (which handles auth) so that
 * /profile/create itself is protected but not redirected.
 */
export function RequireProfile({ children }: RequireProfileProps) {
  const { t } = useTranslation('common');
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    const repo = new ProfileRepository();
    repo.getCurrentProfile().then((p) => setHasProfile(p !== null));
  }, []);

  if (hasProfile === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">{t('status.loading')}</p>
      </div>
    );
  }

  if (!hasProfile) {
    return <Navigate to="/profile/create" replace />;
  }

  return <>{children}</>;
}
