import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSafeReturnTo } from '../../router/returnTo';
import { useUnlock } from './useUnlock';

interface UnlockScreenProps {
  onUnlocked?: () => void;
}

function LoadingSpinner() {
  const { t } = useTranslation('unlock');
  return (
    <div className="flex items-center justify-center gap-2" role="status">
      <svg
        className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-300"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span>{t('deriving-spinner')}</span>
    </div>
  );
}

export function UnlockScreen({ onUnlocked }: UnlockScreenProps) {
  const { t } = useTranslation('unlock');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleUnlocked = useCallback(() => {
    if (onUnlocked) {
      onUnlocked();
    }
    const target = getSafeReturnTo(searchParams);
    navigate(target, { replace: true });
  }, [onUnlocked, searchParams, navigate]);

  const hook = useUnlock(handleUnlocked);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 dark:shadow-black/40">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t('subtitle')}</p>

        {hook.state === 'deriving' && <LoadingSpinner />}

        {hook.state === 'done' && (
          <p className="text-center text-green-700 dark:text-green-400" role="alert">
            {t('done-alert')}
          </p>
        )}

        {hook.state !== 'deriving' && hook.state !== 'done' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void hook.submit();
            }}
            noValidate
          >
            <div className="mb-4">
              <label
                htmlFor="unlock-password"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                {t('password.label')}
              </label>
              <input
                ref={inputRef}
                id="unlock-password"
                type="password"
                value={hook.password}
                onChange={(e) => hook.setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                autoComplete="current-password"
                aria-describedby={hook.error ? 'unlock-error' : undefined}
              />
            </div>

            {hook.error && (
              <p
                id="unlock-error"
                className="mb-4 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {t(`error.${hook.error}`)}
              </p>
            )}

            {hook.failedAttempts >= 3 && (
              <p className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200">
                {t('hint.after-failures')}
              </p>
            )}

            <button
              type="submit"
              disabled={!hook.submitEnabled}
              className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
            >
              {t('submit.label')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
