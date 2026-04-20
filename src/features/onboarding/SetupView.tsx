import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { WarningCallout } from '../../ui';
import { useSetupVault } from './useSetupVault';
import { useLazyZxcvbn } from './useLazyZxcvbn';
import {
  estimateStrengthSync,
  strengthFromZxcvbnScore,
  validateSetup,
  validatePassword,
  type PasswordStrength,
  type SetupValidationError,
} from './passwordValidation';

const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: 'bg-red-500',
  fair: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const STRENGTH_TEXT_COLORS: Record<PasswordStrength, string> = {
  weak: 'text-red-600 dark:text-red-400',
  fair: 'text-yellow-600 dark:text-yellow-400',
  strong: 'text-green-600 dark:text-green-400',
};

const STRENGTH_WIDTHS: Record<PasswordStrength, string> = {
  weak: 'w-1/3',
  fair: 'w-2/3',
  strong: 'w-full',
};

const STRENGTH_ARIA_VALUE: Record<PasswordStrength, number> = {
  weak: 33,
  fair: 66,
  strong: 100,
};

function renderSetupError(error: SetupValidationError, t: TFunction<'onboarding'>): string {
  switch (error.kind) {
    case 'empty':
      return t('setup.validation.empty');
    case 'too-short':
      return t('setup.validation.too-short', { min: error.min });
    case 'mismatch':
      return t('setup.validation.mismatch');
    case 'not-acknowledged':
      return t('setup.validation.not-acknowledged');
  }
}

/**
 * First-run master-password setup screen. Routes forward to
 * /profile/create once the vault meta row is written.
 */
export function SetupView() {
  const { t } = useTranslation('onboarding');
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [showError, setShowError] = useState(false);

  const { status, error: setupError, runSetup } = useSetupVault();
  const zxcvbn = useLazyZxcvbn();
  const zxcvbnReady = zxcvbn.ready;
  const zxcvbnScore = zxcvbn.score;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (status === 'done') {
      navigate('/profile/create', { replace: true });
    }
  }, [status, navigate]);

  const passwordValidation = validatePassword(password);
  const passwordErrorVisible = password.length > 0 && !passwordValidation.valid;

  const strength: PasswordStrength = useMemo(() => {
    if (password.length === 0) return 'weak';
    if (zxcvbnReady && zxcvbnScore) {
      return strengthFromZxcvbnScore(zxcvbnScore(password));
    }
    return estimateStrengthSync(password);
  }, [password, zxcvbnReady, zxcvbnScore]);

  const setupValidation = validateSetup(password, confirmPassword, acknowledged);
  const submitEnabled = setupValidation.valid && status !== 'deriving' && status !== 'done';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupValidation.valid) {
      setShowError(true);
      return;
    }
    setShowError(false);
    void runSetup(password);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 dark:shadow-black/40">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 text-2xl font-bold text-gray-900 focus:outline-none dark:text-gray-100"
        >
          {t('setup.headline')}
        </h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t('setup.intro')}</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('setup.password.label')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setShowError(false);
              }}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoComplete="new-password"
              aria-describedby={passwordErrorVisible ? 'password-error' : undefined}
              disabled={status === 'deriving' || status === 'done'}
            />
            {password.length > 0 && (
              <div className="mt-1">
                <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-1.5 rounded-full transition-all ${STRENGTH_COLORS[strength]} ${STRENGTH_WIDTHS[strength]}`}
                    role="progressbar"
                    aria-valuenow={STRENGTH_ARIA_VALUE[strength]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('setup.strength.aria-label', {
                      label: t(`setup.strength.${strength}`),
                    })}
                  />
                </div>
                <p className={`mt-1 text-sm ${STRENGTH_TEXT_COLORS[strength]}`}>
                  {t(`setup.strength.${strength}`)}
                </p>
              </div>
            )}
            {passwordErrorVisible && !passwordValidation.valid && (
              <p
                id="password-error"
                className="mt-1 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {renderSetupError(passwordValidation.error, t)}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="confirm-password"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('setup.password.confirm-label')}
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setShowError(false);
              }}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoComplete="new-password"
              disabled={status === 'deriving' || status === 'done'}
            />
          </div>

          <div className="mb-4">
            <WarningCallout severity="warning">
              <p className="mb-2">{t('setup.warning.body')}</p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => {
                    setAcknowledged(e.target.checked);
                    setShowError(false);
                  }}
                  className="mt-0.5"
                  disabled={status === 'deriving' || status === 'done'}
                />
                <span>{t('setup.warning.acknowledge')}</span>
              </label>
            </WarningCallout>
          </div>

          {showError && !setupValidation.valid && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {renderSetupError(setupValidation.error, t)}
            </p>
          )}

          {setupError?.kind === 'meta-write-failed' && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {t('setup.error.meta-write-failed')}
            </p>
          )}

          <button
            type="submit"
            disabled={!submitEnabled}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
          >
            {status === 'deriving' ? t('setup.submit.deriving') : t('setup.submit.label')}
          </button>

          {status === 'deriving' && (
            <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400" role="status">
              {t('setup.deriving-hint')}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
