import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConsentRequiredReason } from '../types';

export interface ConsentDialogProps {
  reason: ConsentRequiredReason;
  onGrant: (rememberForSession: boolean) => void;
  onDecline: () => void;
}

/**
 * Modal dialog asking the user to consent to a privacy-relevant
 * pipeline step that wasn't implied by the upload action.
 *
 * Currently only `pdf-rasterization` is surfaced (PDF without text
 * layer needs page rasterization + image upload). The dialog defaults
 * focus to the Cancel button (safer default per accessibility +
 * privacy heuristics: "no" should never be a single-keystroke
 * mistake).
 */
export function ConsentDialog({ reason, onGrant, onDecline }: ConsentDialogProps) {
  const { t } = useTranslation('document-import');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [remember, setRemember] = useState(false);
  const checkboxId = useId();

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDecline();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDecline]);

  const prefix = `consent.${reason}` as const;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="consent-dialog"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900 dark:shadow-black/60">
        <h2
          id="consent-dialog-title"
          className="text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          {t(`${prefix}.title`)}
        </h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">{t(`${prefix}.explanation`)}</p>
        <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t(`${prefix}.consequence`)}
        </p>
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          {t(`${prefix}.remember-checkbox`)}
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onDecline}
            className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t(`${prefix}.cancel-button`)}
          </button>
          <button
            type="button"
            onClick={() => onGrant(remember)}
            className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            {t(`${prefix}.confirm-button`)}
          </button>
        </div>
      </div>
    </div>
  );
}
