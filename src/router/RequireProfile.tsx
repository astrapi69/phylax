import { useState, useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProfileRepository } from '../db/repositories/profileRepository';
import { useActiveProfile } from '../features/active-profile';

interface RequireProfileProps {
  children: ReactNode;
}

/**
 * Route wrapper that redirects to /profile/create if no profile exists.
 *
 * Separated from ProtectedRoute (which handles auth) so that
 * /profile/create itself is protected but not redirected.
 *
 * M-04: also bridges the single-profile MVP to multi-profile by
 * adopting the first stored profile as the active one when the
 * ActiveProfileContext starts up empty. After this bootstrap step
 * every feature hook scopes its queries via `useActiveProfile`.
 * If the stored activeProfileId no longer points at an existing
 * profile (e.g. it was deleted from another tab), we likewise fall
 * back to the first profile rather than rendering an empty view.
 */
export function RequireProfile({ children }: RequireProfileProps) {
  const { t } = useTranslation('common');
  const { activeProfileId, setActiveProfileId } = useActiveProfile();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const repo = new ProfileRepository();
    void (async () => {
      try {
        const profiles = await repo.list();
        if (cancelled) return;
        if (profiles.length === 0) {
          setHasProfile(false);
          return;
        }
        const existing = activeProfileId
          ? profiles.find((p) => p.id === activeProfileId)
          : undefined;
        if (!existing) {
          const fallback = profiles[0];
          if (fallback) setActiveProfileId(fallback.id);
        }
        setHasProfile(true);
      } catch {
        // Lock race during test teardown / route unmount: the
        // keystore may be cleared while a pending decrypt is in
        // flight. Swallow the error; the surrounding ProtectedRoute
        // will redirect to /unlock on the next render.
        if (cancelled) return;
        setHasProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, setActiveProfileId]);

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
