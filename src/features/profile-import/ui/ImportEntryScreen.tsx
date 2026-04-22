import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Upper bound for a single Markdown import. Real profiles are a few KB;
 * a 1 MB ceiling blocks accidental massive pastes or uploads without
 * inconveniencing normal usage. Module-level constant so a future
 * configurable setting is a one-symbol refactor.
 */
const MAX_IMPORT_FILE_SIZE_BYTES = 1024 * 1024;
const MIN_PASTE_LENGTH = 100;

interface ImportEntryScreenProps {
  onSubmit: (content: string, sourceLabel: string) => void;
  onCancel: () => void;
}

export function ImportEntryScreen({ onSubmit, onCancel }: ImportEntryScreenProps) {
  const { t } = useTranslation('import');
  const [pasted, setPasted] = useState('');
  const [fileContent, setFileContent] = useState<{ content: string; name: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileError(null);
      const file = e.target.files?.[0];
      if (!file) {
        setFileContent(null);
        return;
      }
      if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        setFileError(
          t('entry.file.too-large', {
            size: formatSize(file.size),
            max: formatSize(MAX_IMPORT_FILE_SIZE_BYTES),
          }),
        );
        setFileContent(null);
        return;
      }
      try {
        const content = await readFileAsText(file);
        setFileContent({ content, name: file.name });
      } catch {
        setFileError(t('entry.file.read-failed'));
        setFileContent(null);
      }
    },
    [t],
  );

  const canSubmit = fileContent !== null || pasted.trim().length >= MIN_PASTE_LENGTH;

  const handleSubmit = () => {
    if (fileContent) {
      onSubmit(fileContent.content, fileContent.name);
      return;
    }
    if (pasted.trim().length >= MIN_PASTE_LENGTH) {
      onSubmit(pasted, t('entry.paste.source-label'));
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {t('entry.heading')}
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t('entry.intro')}</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            {t('entry.file.heading')}
          </h2>
          <label
            htmlFor="import-file"
            className="flex w-full cursor-pointer items-center justify-center rounded-sm border border-dashed border-gray-300 bg-white px-4 py-8 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
          >
            <span>{t('entry.file.cta')}</span>
          </label>
          <input
            ref={fileInputRef}
            id="import-file"
            type="file"
            accept=".md,text/markdown,text/plain"
            onChange={(e) => void handleFileChange(e)}
            className="sr-only"
            aria-describedby="import-file-status"
          />
          <div id="import-file-status" className="mt-2 text-xs" aria-live="polite">
            {fileError && <p className="text-red-600 dark:text-red-400">{fileError}</p>}
            {fileContent && (
              <p className="text-green-700 dark:text-green-400">
                {t('entry.file.loaded', {
                  name: fileContent.name,
                  size: formatSize(fileContent.content.length),
                })}
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            {t('entry.paste.heading')}
          </h2>
          <label htmlFor="import-paste" className="sr-only">
            {t('entry.paste.sr-label')}
          </label>
          <textarea
            id="import-paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={t('entry.paste.placeholder')}
            className="min-h-48 w-full rounded-sm border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
            {t('entry.paste.char-count', { chars: pasted.length, min: MIN_PASTE_LENGTH })}
          </p>
        </section>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
        >
          {t('action.next')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('common:action.cancel')}
        </button>
      </div>
    </div>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file, 'utf-8');
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
