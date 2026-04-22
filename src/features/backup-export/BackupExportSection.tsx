import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useBackupExport, type BackupExportError, MIN_PASSWORD_LENGTH } from './useBackupExport';

function renderError(error: BackupExportError, t: TFunction<'backup-export'>): string {
  switch (error.kind) {
    case 'password-too-short':
      return t('error.password-too-short', { min: MIN_PASSWORD_LENGTH });
    case 'no-profile':
      return t('error.no-profile');
    case 'locked':
      return t('error.locked');
    case 'crypto-unavailable':
      return t('error.crypto-unavailable');
    case 'encryption-failed':
      return t('error.encryption-failed');
    case 'download-failed':
      return t('error.download-failed');
  }
}

/**
 * Settings-panel section that produces an encrypted `.phylax` backup
 * file and triggers a browser download.
 *
 * The user enters a password that will encrypt the backup. It can be
 * the current master password (most common) or a different one for
 * scoped sharing. The in-memory vault key is never touched; a fresh
 * key is derived from the input password + a fresh salt for each
 * export.
 */
export function BackupExportSection() {
  const { t } = useTranslation('backup-export');
  const [password, setPassword] = useState('');
  const { state, runExport, reset } = useBackupExport();

  const working =
    state.kind === 'validating' ||
    state.kind === 'building' ||
    state.kind === 'deriving' ||
    state.kind === 'encrypting';

  const submitEnabled = password.length >= MIN_PASSWORD_LENGTH && !working;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitEnabled) return;
    void runExport(password);
  };

  const statusText = (() => {
    switch (state.kind) {
      case 'deriving':
        return t('status.deriving');
      case 'encrypting':
        return t('status.encrypting');
      case 'ready':
        return t('status.ready');
      default:
        return null;
    }
  })();

  return (
    <section aria-labelledby="backup-export-heading">
      <h3
        id="backup-export-heading"
        className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('section.heading')}
      </h3>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('section.description')}</p>

      {state.kind === 'downloaded' ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-sm border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-900/30 dark:text-green-100"
        >
          <p className="font-medium">{t('status.downloaded')}</p>
          <p className="mt-1 font-mono text-xs">{state.filename}</p>
          <button
            type="button"
            onClick={() => {
              setPassword('');
              reset();
            }}
            className="mt-3 rounded-sm border border-green-500 px-3 py-1.5 text-sm font-medium text-green-900 transition-colors hover:bg-green-100 dark:border-green-400 dark:text-green-100 dark:hover:bg-green-900/50"
          >
            {t('status.new-backup')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label
              htmlFor="backup-export-password"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('form.password-label')}
            </label>
            <input
              id="backup-export-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={working}
              autoComplete="current-password"
              className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {t('form.password-help', { min: MIN_PASSWORD_LENGTH })}
            </p>
          </div>

          <button
            type="submit"
            disabled={!submitEnabled}
            className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
          >
            {working ? t('form.submit-working') : t('form.submit-label')}
          </button>

          {statusText && (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              {statusText}
            </p>
          )}

          {state.kind === 'error' && (
            <p
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100"
            >
              {renderError(state.error, t)}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
