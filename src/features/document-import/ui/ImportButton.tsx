import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACCEPTED_DOCUMENT_TYPES } from '../../documents/useDocumentUpload';
import { ImportFlow } from './ImportFlow';
import type { CommitResult } from '../commit';

export interface ImportButtonProps {
  /** Called after a successful commit so the parent can refresh lists. */
  onImported?: (result: CommitResult) => void;
}

/**
 * Documents-page entry point for the IMP-04 flow. Distinct from
 * `DocumentUploadButton` (D-02): "Importieren" runs classify +
 * extract + commit instead of just storing the file.
 *
 * The picked file is held in component state until the modal closes.
 * On close (success, cancel, decline) the file reference is dropped
 * so closing the modal cleans up the in-memory blob.
 */
export function ImportButton({ onImported }: ImportButtonProps) {
  const { t } = useTranslation('document-import');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPickedFile(file);
  };

  const handleClose = (result?: CommitResult) => {
    setPickedFile(null);
    if (result) onImported?.(result);
  };

  return (
    <>
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center justify-center rounded-md border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-blue-50 dark:border-blue-500 dark:bg-gray-900 dark:text-blue-300 dark:focus-within:ring-offset-gray-900 dark:hover:bg-gray-800"
        title={t('import.button-hint')}
        data-testid="import-button"
      >
        {t('import.button')}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
          onChange={handleChange}
          className="sr-only"
        />
      </label>
      {pickedFile ? <ImportFlow initialFile={pickedFile} onClose={handleClose} /> : null}
    </>
  );
}
