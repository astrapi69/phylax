import { useState, useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLockState, onLockStateChange } from '../crypto';
import { metaExists } from '../db/meta';

interface ProtectedRouteProps {
  children: ReactNode;
}

type AuthState = 'loading' | 'onboarding' | 'locked' | 'ready';

/**
 * Auth guard that wraps authenticated routes.
 *
 * - No meta row -> redirect to /welcome (first-run entry, ONB-01a)
 * - Meta exists but keyStore locked -> redirect to /unlock with returnTo
 * - KeyStore unlocked -> render children
 *
 * Subscribes to onLockStateChange so auto-lock (or manual lock) triggers
 * a redirect to /unlock with the current path preserved as returnTo.
 * Uses `replace` on Navigate to keep /unlock out of back-button history.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { t } = useTranslation('common');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const location = useLocation();

  useEffect(() => {
    metaExists().then((exists) => {
      if (!exists) {
        setAuthState('onboarding');
      } else if (getLockState() === 'locked') {
        setAuthState('locked');
      } else {
        setAuthState('ready');
      }
    });
  }, []);

  // Subscribe to lock state changes (auto-lock, manual lock)
  useEffect(() => {
    const unsub = onLockStateChange((state) => {
      if (state === 'locked') {
        setAuthState('locked');
      }
    });
    return unsub;
  }, []);

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">{t('status.loading')}</p>
      </div>
    );
  }

  if (authState === 'onboarding') {
    return <Navigate to="/welcome" replace />;
  }

  if (authState === 'locked') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/unlock?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
