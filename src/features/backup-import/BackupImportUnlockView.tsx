import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { unlockWithKey } from '../../crypto';
import { decryptBackup, type DecryptError } from './decryptBackup';
import { populateVault, type PopulateError } from './populateVault';
import type { ParsedPhylaxFile } from './parseBackupFile';
import { createRateLimiter, BACKUP_IMPORT_STORAGE_KEY } from '../unlock/rateLimit';

type ImportStatus = 'idle' | 'deriving' | 'populating' | 'done' | 'error';

type ImportError = DecryptError | PopulateError | { kind: 'rate-limited'; remainingMs: number };

const TICK_INTERVAL_MS = 250;

const limiter = createRateLimiter(BACKUP_IMPORT_STORAGE_KEY);

function renderImportError(error: ImportError, t: TFunction<'backup-import'>): string {
  switch (error.kind) {
    case 'wrong-password':
      return t('error.wrong-password');
    case 'corrupted':
      return t('error.corrupted');
    case 'unsupported-inner-schema':
      return t('error.unsupported-version', { version: String(error.schemaVersion) });
    case 'crypto-failed':
      return t('error.crypto-failed');
    case 'write-failed':
      return t('error.populate-failed', { detail: error.detail });
    case 'rate-limited':
      return t('error.rate-limited', {
        count: Math.ceil(error.remainingMs / 1000),
      });
  }
}

interface LocationStateShape {
  parsed?: ParsedPhylaxFile;
  fileName?: string;
}

export function BackupImportUnlockView() {
  const { t } = useTranslation('backup-import');
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationStateShape | null) ?? null;

  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<ImportError | null>(null);
  const [remainingLockoutMs, setRemainingLockoutMs] = useState(() =>
    limiter.getRemainingLockoutMs(),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (remainingLockoutMs <= 0) return undefined;
    const id = setInterval(() => {
      const next = limiter.getRemainingLockoutMs();
      setRemainingLockoutMs(next);
      if (next <= 0) clearInterval(id);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [remainingLockoutMs]);

  const isLocked = remainingLockoutMs > 0;
  const parsed = state?.parsed;
  const fileName = state?.fileName;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!parsed || password.length === 0) return;
      if (limiter.getRemainingLockoutMs() > 0) return;

      setStatus('deriving');
      setError(null);

      const decryptResult = await decryptBackup(parsed, password);
      if (!decryptResult.ok) {
        if (decryptResult.error.kind === 'wrong-password') {
          const next = limiter.recordFailedAttempt();
          setRemainingLockoutMs(next.lockedUntil !== null ? limiter.getRemainingLockoutMs() : 0);
        }
        setError(decryptResult.error);
        setStatus('error');
        setPassword('');
        return;
      }

      setStatus('populating');

      const populateResult = await populateVault(
        decryptResult.dump,
        decryptResult.key,
        decryptResult.saltBytes,
      );
      if (!populateResult.ok) {
        setError(populateResult.error);
        setStatus('error');
        return;
      }

      unlockWithKey(decryptResult.key);
      limiter.recordSuccessfulAttempt();
      setStatus('done');

      const hasProfile = decryptResult.dump.rows.profiles.length > 0;
      navigate(hasProfile ? '/profile' : '/profile/create', { replace: true });
    },
    [parsed, password, navigate],
  );

  if (!parsed || !fileName) {
    return <Navigate to="/backup/import/select" replace />;
  }

  const submitEnabled =
    password.length > 0 && status !== 'deriving' && status !== 'populating' && !isLocked;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 dark:shadow-black/40">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('unlock.heading')}
        </h1>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{t('unlock.description')}</p>
        <p className="mb-6 text-sm font-medium text-gray-800 dark:text-gray-200">
          {t('unlock.filename-readout', { name: fileName })}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="mb-4">
            <label
              htmlFor="backup-import-password"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('unlock.password.label')}
            </label>
            <input
              ref={inputRef}
              id="backup-import-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLocked || status === 'deriving' || status === 'populating'}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-800/50"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {renderImportError(error, t)}
            </p>
          )}

          {isLocked && (
            <p
              role="status"
              aria-live="polite"
              className="mb-3 text-sm text-yellow-700 dark:text-yellow-300"
            >
              {t('error.rate-limited', { count: Math.ceil(remainingLockoutMs / 1000) })}
            </p>
          )}

          <button
            type="submit"
            disabled={!submitEnabled}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
          >
            {status === 'deriving'
              ? t('unlock.submit.deriving')
              : status === 'populating'
                ? t('unlock.submit.populating')
                : t('unlock.submit.label')}
          </button>
        </form>
      </div>
    </main>
  );
}
