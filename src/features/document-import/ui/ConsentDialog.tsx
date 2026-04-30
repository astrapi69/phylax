import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog as O20ConfirmDialog } from '../../../ui';
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
 *
 * TD-12 migration: composes the shared `<ConfirmDialog>` from
 * `src/ui/Modal/`. The primitive provides the focus trap, Escape
 * handler, backdrop, cancel-focused-on-mount default, and the
 * non-destructive (blue confirm + role="dialog") variant chrome.
 * Backdrop click does NOT close (O-20 `closeOnBackdropClick` default
 * = false) - consent posture stays conservative; user must click
 * Cancel or press Escape to decline explicitly.
 */
export function ConsentDialog({ reason, onGrant, onDecline }: ConsentDialogProps) {
  const { t } = useTranslation('document-import');
  const [remember, setRemember] = useState(false);
  const checkboxId = useId();

  const prefix = `consent.${reason}` as const;
  return (
    <O20ConfirmDialog
      open
      onClose={onDecline}
      title={t(`${prefix}.title`)}
      body={
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t(`${prefix}.explanation`)}
          </p>
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
        </div>
      }
      cancelLabel={t(`${prefix}.cancel-button`)}
      confirmLabel={t(`${prefix}.confirm-button`)}
      onConfirm={() => onGrant(remember)}
      testId="consent-dialog"
    />
  );
}
