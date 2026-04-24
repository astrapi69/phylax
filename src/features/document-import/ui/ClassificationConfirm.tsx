import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentClassification } from '../types';

export interface ClassificationConfirmProps {
  classification: DocumentClassification;
  onConfirm: () => void;
  onReject: () => void;
}

/**
 * Banner shown when classification confidence falls below
 * `MIN_CLASSIFICATION_CONFIDENCE`. Binary choice — confirm and
 * proceed to extraction, or reject and abort the session. Type
 * override (e.g., user picks a different DocumentType) is deferred
 * to IMP-06 once real-world uncertainty data is in.
 */
export function ClassificationConfirm({
  classification,
  onConfirm,
  onReject,
}: ClassificationConfirmProps) {
  const { t } = useTranslation('document-import');
  const rejectRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    rejectRef.current?.focus();
  }, []);

  const confidence = classification.confidence?.toFixed(2) ?? '?';
  return (
    <div
      data-testid="classification-confirm"
      className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
    >
      <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
        {t('import.classification-confirm.title')}
      </h3>
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {t('import.classification-confirm.body', {
          confidence,
          type: classification.type,
        })}
      </p>
      <div className="flex justify-end gap-3">
        <button
          ref={rejectRef}
          type="button"
          onClick={onReject}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('import.classification-confirm.reject')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          {t('import.classification-confirm.confirm')}
        </button>
      </div>
    </div>
  );
}
