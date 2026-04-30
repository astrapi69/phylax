import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ACCEPTED_DOCUMENT_TYPES,
  useDocumentUpload,
  type DocumentUploadError,
  type UseDocumentUploadResult,
} from './useDocumentUpload';

export interface DocumentUploadButtonProps {
  /** Optional callback invoked when upload completes successfully. */
  onUploaded?: (documentId: string) => void;
}

/**
 * Visible label-styled file picker. Wraps a native `<input type="file">`
 * and routes the selection through the upload state machine. Renders
 * the current status (uploading / success / error) inline so the
 * component is self-contained for D-02; D-04 will surface uploaded
 * documents in a list and can override or hide this status block.
 */
export function DocumentUploadButton({ onUploaded }: DocumentUploadButtonProps) {
  const { t } = useTranslation('documents');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const upload = useDocumentUpload();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always clear the input value so the same file can be re-selected
    // after a failed upload (browsers suppress change events on
    // identical selections by default).
    e.target.value = '';
    if (!file) return;
    await upload.upload(file);
    if (upload.status.kind === 'success') {
      onUploaded?.(upload.status.document.id);
    }
  };

  const isUploading = upload.status.kind === 'uploading';

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-blue-700 dark:focus-within:ring-offset-gray-900 ${
          isUploading ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        {isUploading ? t('upload.button.uploading') : t('upload.button.idle')}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
          disabled={isUploading}
          onChange={handleChange}
          className="sr-only"
        />
      </label>
      <UploadStatusBlock state={upload} />
    </div>
  );
}

const SUCCESS_AUTO_DISMISS_MS = 5000;

function UploadStatusBlock({ state }: { state: UseDocumentUploadResult }) {
  const { t } = useTranslation('documents');
  const { reset } = state;
  const isSuccess = state.status.kind === 'success';

  // BUG-04 (P-16 smoke walk, 2026-04-30): the success message used to
  // persist forever - if the user deleted the freshly-uploaded row
  // via the inline trash button, the green "{{filename}} wurde
  // gespeichert" line stayed on screen referencing a now-deleted
  // document. Auto-dismiss after 5s + a manual close button on the
  // banner cover both the row-delete case and general staleness.
  useEffect(() => {
    if (!isSuccess) return;
    const id = setTimeout(() => reset(), SUCCESS_AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [isSuccess, reset]);

  if (state.status.kind === 'idle' || state.status.kind === 'uploading') {
    return null;
  }

  if (state.status.kind === 'success') {
    return (
      <div
        role="status"
        className="flex items-start justify-between gap-3 text-sm text-green-700 dark:text-green-400"
        data-testid="upload-success"
      >
        <span>{t('upload.success', { filename: state.status.document.filename })}</span>
        <button
          type="button"
          onClick={reset}
          aria-label={t('upload.success-dismiss')}
          data-testid="upload-success-dismiss"
          className="rounded-sm px-1 text-xs leading-none text-green-700 hover:text-green-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-green-400 dark:hover:text-green-200"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="upload-error">
      {renderUploadError(state.status.error, t)}
    </p>
  );
}

function renderUploadError(
  error: DocumentUploadError,
  t: ReturnType<typeof useTranslation<'documents'>>['t'],
): string {
  switch (error.kind) {
    case 'no-profile':
      return t('upload.error.no-profile');
    case 'unsupported-type':
      return t('upload.error.unsupported-type', { mimeType: error.mimeType });
    case 'file-too-large':
      return t('upload.error.file-too-large', {
        sizeMb: (error.actualBytes / (1024 * 1024)).toFixed(1),
        limitMb: (error.limitBytes / (1024 * 1024)).toFixed(0),
      });
    case 'read-failed':
      return t('upload.error.read-failed');
    case 'generic':
      return t('upload.error.generic');
  }
}
