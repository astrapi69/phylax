import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { WarningCallout } from '../../ui';
import { metaExists } from '../../db/meta';
import {
  parseBackupFile,
  type ParseError,
  type ParsedPhylaxFile,
  type BackupMetadata,
} from './parseBackupFile';

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

export function BackupImportSelectView() {
  const { t, i18n } = useTranslation('backup-import');
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [parsed, setParsed] = useState<ParsedPhylaxFile | null>(null);
  const [metadata, setMetadata] = useState<BackupMetadata | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [vaultExists, setVaultExists] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
    void metaExists().then(setVaultExists);
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsed(null);
    setMetadata(null);
    const result = await parseBackupFile(file);
    if (result.valid) {
      setParsed(result.parsed);
      setMetadata(result.metadata);
    } else {
      setParseError(result.error);
    }
  }, []);

  const readyToContinue = parsed !== null && metadata !== null && (!vaultExists || acknowledged);

  const handleContinue = () => {
    if (!parsed || !metadata) return;
    navigate('/backup/import/unlock', {
      state: { parsed, fileName: metadata.fileName },
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 dark:shadow-black/40">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 text-2xl font-bold text-gray-900 focus:outline-hidden dark:text-gray-100"
        >
          {t('select.heading')}
        </h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t('select.description')}</p>

        {vaultExists && (
          <div className="mb-4">
            <WarningCallout severity="danger" title={t('select.overwrite-warning.title')}>
              <p className="mb-2">{t('select.overwrite-warning.body')}</p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t('select.overwrite-warning.acknowledge')}</span>
              </label>
            </WarningCallout>
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="backup-file-input"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            {t('select.file-picker-label')}
          </label>
          <input
            id="backup-file-input"
            type="file"
            accept=".phylax,application/json,application/x-phylax-backup"
            onChange={(e) => void handleFile(e)}
            className="block w-full text-sm text-gray-600 dark:text-gray-400"
          />
        </div>

        {parseError && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {renderParseError(parseError, t)}
          </p>
        )}

        {metadata && parsed && (
          <dl
            data-testid="backup-metadata"
            className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-sm border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
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
            <dd className="text-gray-900 dark:text-gray-100">
              {formatCreatedAt(metadata.created, i18n.language)}
            </dd>

            <dt className="font-medium text-gray-700 dark:text-gray-300">
              {t('select.metadata.source')}
            </dt>
            <dd className="text-gray-900 dark:text-gray-100">Phylax {metadata.sourceAppVersion}</dd>
          </dl>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!readyToContinue}
          className="w-full rounded-sm bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
        >
          {t('select.continue')}
        </button>

        <Link
          to="/welcome"
          className="mt-4 block text-center text-sm text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          {t('select.back-to-welcome')}
        </Link>
      </div>
    </main>
  );
}
