import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ConfirmDialog, PasswordVisibilityToggle } from '../../ui';
import { replaceStoredKey } from '../../crypto';
import {
  parseBackupFile,
  type BackupMetadata,
  type ParsedPhylaxFile,
  type ParseError,
} from './parseBackupFile';
import { useBackupImport, type BackupImportError } from './useBackupImport';

const POST_SUCCESS_NAVIGATE_DELAY_MS = 1500;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCreatedAt(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function renderParseError(error: ParseError, t: TFunction<'backup-import'>): string {
  switch (error.kind) {
    case 'invalid-json':
      return t('error.invalid-json');
    case 'missing-field':
      return t('error.missing-field', { field: error.field });
    case 'unsupported-version':
      return t('error.unsupported-version', { version: String(error.version) });
    case 'wrong-type':
      return t('error.wrong-type');
    case 'too-large':
      return t('error.too-large', { size: error.sizeMb });
    case 'corrupted':
      return t('error.corrupted');
  }
}

function renderImportError(error: BackupImportError, t: TFunction<'backup-import'>): string {
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

/**
 * Settings-section variant of the `.phylax` backup-restore flow.
 * Parallel entry point to the pre-auth full-screen routes
 * (`/backup/import/select` + `/backup/import/unlock`).
 *
 * Pre-auth routes serve users without an in-memory key (first-run
 * setup, forgotten-password recovery). This section serves
 * authenticated users restoring a backup over their current state
 * (e.g. moving from one device to another after both were set up
 * independently, or rolling back to a prior snapshot).
 *
 * Shares the underlying `useBackupImport` hook + the
 * `BACKUP_IMPORT_STORAGE_KEY` rate-limiter with the pre-auth
 * surface — both consumers see identical errors, share one
 * lockout budget, and rely on the same decrypt + populate
 * pipeline. Independent rate-limiters would let an attacker
 * double their attempts by alternating surfaces.
 *
 * Progressive disclosure: file picker → metadata + acknowledge →
 * password → confirm dialog → restore → navigate to /profile.
 */
export function BackupImportSection() {
  const { t, i18n } = useTranslation('backup-import');
  const navigate = useNavigate();
  const importer = useBackupImport();

  const [parsed, setParsed] = useState<ParsedPhylaxFile | null>(null);
  const [metadata, setMetadata] = useState<BackupMetadata | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setParseError(null);
      setParsed(null);
      setMetadata(null);
      setAcknowledged(false);
      setPassword('');
      importer.reset();
      if (!file) return;
      const result = await parseBackupFile(file);
      if (result.valid) {
        setParsed(result.parsed);
        setMetadata(result.metadata);
      } else {
        setParseError(result.error);
      }
    },
    [importer],
  );

  const handleSubmitClick = useCallback(() => {
    if (!parsed || !acknowledged || password.length === 0) return;
    setConfirmOpen(true);
  }, [parsed, acknowledged, password]);

  const handleConfirm = useCallback(async () => {
    if (!parsed) return;
    const result = await importer.run(parsed, password);
    setConfirmOpen(false);
    if (result.ok) {
      // Settings context: user is already unlocked under the prior
      // master key. The vault has been re-encrypted under the
      // backup-derived key inside populateVault; swap the in-memory
      // key to match. `replaceStoredKey` does NOT fire lock-state
      // listeners, so ProtectedRoute does not see a transient
      // 'locked' state and won't redirect to /unlock mid-flow.
      replaceStoredKey(result.key);
    } else {
      setPassword('');
    }
  }, [importer, parsed, password]);

  // After a successful restore, leave the success banner visible
  // briefly, then navigate to /profile so the user sees the
  // restored data. Pre-auth route navigates immediately; Settings
  // adds a short delay so the user registers the success message
  // before context shifts.
  useEffect(() => {
    if (importer.status !== 'done') return undefined;
    const id = setTimeout(() => {
      navigate('/profile', { replace: true });
    }, POST_SUCCESS_NAVIGATE_DELAY_MS);
    return () => clearTimeout(id);
  }, [importer.status, navigate]);

  const isWorking = importer.status === 'deriving' || importer.status === 'populating';
  const isDone = importer.status === 'done';
  const submitDisabled =
    !parsed || !acknowledged || password.length === 0 || isWorking || isDone || importer.isLocked;

  const formattedCreated = metadata ? formatCreatedAt(metadata.created, i18n.language) : '';

  return (
    <section aria-labelledby="backup-import-heading" data-testid="backup-import-section">
      <h3
        id="backup-import-heading"
        className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('section.heading')}
      </h3>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('section.description')}</p>

      {isDone ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-sm border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-900/30 dark:text-green-100"
          data-testid="backup-import-success"
        >
          <p className="font-medium">{t('section.status-success', { date: formattedCreated })}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="backup-import-section-file"
              className={`inline-flex min-h-[44px] items-center rounded-sm border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 ${
                isWorking ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
              data-testid="backup-import-section-file-label"
            >
              {metadata?.fileName ?? t('section.file-picker-label')}
            </label>
            <input
              id="backup-import-section-file"
              type="file"
              accept=".phylax,application/json,application/x-phylax-backup"
              onChange={(e) => void handleFile(e)}
              disabled={isWorking}
              className="sr-only"
              data-testid="backup-import-section-file-input"
            />
          </div>

          {parseError && (
            <p
              className="text-sm text-red-600 dark:text-red-400"
              role="alert"
              data-testid="backup-import-section-parse-error"
            >
              {renderParseError(parseError, t)}
            </p>
          )}

          {metadata && parsed && (
            <dl
              data-testid="backup-import-section-metadata"
              className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-sm border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <dt className="font-medium text-gray-700 dark:text-gray-300">
                {t('select.metadata.filename')}
              </dt>
              <dd className="text-gray-900 dark:text-gray-100">{metadata.fileName}</dd>

              <dt className="font-medium text-gray-700 dark:text-gray-300">
                {t('select.metadata.size')}
              </dt>
              <dd className="text-gray-900 dark:text-gray-100">
                {formatFileSize(metadata.fileSizeBytes)}
              </dd>

              <dt className="font-medium text-gray-700 dark:text-gray-300">
                {t('select.metadata.created')}
              </dt>
              <dd className="text-gray-900 dark:text-gray-100">{formattedCreated}</dd>

              <dt className="font-medium text-gray-700 dark:text-gray-300">
                {t('select.metadata.source')}
              </dt>
              <dd className="text-gray-900 dark:text-gray-100">
                Phylax {metadata.sourceAppVersion}
              </dd>
            </dl>
          )}

          {parsed && metadata && (
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={isWorking}
                className="mt-0.5"
                data-testid="backup-import-section-acknowledge"
              />
              <span>{t('section.acknowledge-checkbox')}</span>
            </label>
          )}

          {parsed && acknowledged && (
            <div>
              <label
                htmlFor="backup-import-section-password"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                {t('section.password-label')}
              </label>
              <div className="relative">
                <input
                  id="backup-import-section-password"
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    importer.clearError();
                  }}
                  disabled={isWorking || importer.isLocked}
                  autoComplete="current-password"
                  className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 pr-12 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-800/50"
                  data-testid="backup-import-section-password-input"
                />
                <PasswordVisibilityToggle
                  visible={passwordVisible}
                  onToggle={() => setPasswordVisible((v) => !v)}
                  labelShow={t('common:password-toggle.password-show')}
                  labelHide={t('common:password-toggle.password-hide')}
                  disabled={isWorking || importer.isLocked}
                />
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {t('section.password-help')}
              </p>
            </div>
          )}

          {importer.error && (
            <p
              role="alert"
              className="text-sm text-red-600 dark:text-red-400"
              data-testid="backup-import-section-error"
            >
              {renderImportError(importer.error, t)}
            </p>
          )}

          {importer.isLocked && (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-yellow-700 dark:text-yellow-300"
            >
              {t('error.rate-limited', {
                count: Math.ceil(importer.remainingLockoutMs / 1000),
              })}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={submitDisabled}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
            data-testid="backup-import-section-submit"
          >
            {isWorking && <RestoreSpinner />}
            {isWorking ? t('section.submit-busy') : t('section.submit-label')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('section.confirm-dialog.title')}
        body={
          <p data-testid="backup-import-confirm-body">
            {formattedCreated.length > 0
              ? t('section.confirm-dialog.body-with-date', { date: formattedCreated })
              : t('section.confirm-dialog.body-no-date')}
          </p>
        }
        confirmLabel={t('section.confirm-dialog.confirm')}
        cancelLabel={t('section.confirm-dialog.cancel')}
        onConfirm={() => void handleConfirm()}
        variant="destructive"
        busy={isWorking}
        busyLabel={t('section.confirm-dialog.busy')}
        testId="backup-import-confirm-dialog"
        cancelTestId="backup-import-confirm-cancel"
        confirmTestId="backup-import-confirm-confirm"
      />
    </section>
  );
}

/**
 * Inline spinner shown next to the "Wird wiederhergestellt..." button
 * label during the populating phase. Uses Tailwind's `animate-spin`
 * with currentColor so it inherits the button's text color (white,
 * or gray when disabled). Matches the SVG pattern in `UnlockView`'s
 * `LoadingSpinner` component.
 */
function RestoreSpinner() {
  return (
    <svg
      aria-hidden
      data-testid="backup-import-section-spinner"
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
