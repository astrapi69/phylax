import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResetAllData } from './useResetAllData';

export interface ResetDialogProps {
  /** Closes the dialog without resetting. */
  onCancel: () => void;
}

/**
 * The string the user must type, character-for-character, to enable
 * the destructive confirm button. Stays English across all locales —
 * a fixed, recognizable test target with no localization drift.
 * Parallels how git command names are not translated.
 */
const CHALLENGE_STRING = 'RESET';

/**
 * Type-challenge confirmation panel for the full data reset.
 *
 * Design (D-08 destructive-flow a11y patterns + tighter guard):
 * - Confirm button stays disabled until the input EXACTLY matches
 *   `RESET` (case-sensitive, no whitespace, no locale variants).
 *   Type-challenge is industry standard for irreversible destructive
 *   actions (GitHub repo deletion, Stripe account deletion).
 * - Cancel button is focused on mount — keyboard users entering this
 *   dialog should not have the destructive Confirm pre-focused.
 * - Escape cancels (scoped via `onKeyDown`, no global window listener).
 * - No master-password guard. The most common reset trigger is
 *   forgotten password, so requiring the password to wipe data after
 *   forgetting it would be paradoxical.
 * - Wipe orchestration delegated to `useResetAllData` — this
 *   component is presentation only.
 *
 * Polish backlog (P-17 candidate): when O-20 ships the modal-dialog
 * system, this inline panel migrates to the shared modal with focus
 * trap and backdrop. Same migration pattern as D-08's delete
 * confirmation.
 */
export function ResetDialog({ onCancel }: ResetDialogProps) {
  const { t } = useTranslation('reset');
  const [challengeInput, setChallengeInput] = useState('');
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const reset = useResetAllData();

  const matches = challengeInput === CHALLENGE_STRING;
  const canConfirm = matches && !reset.inProgress;

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !reset.inProgress) {
        e.preventDefault();
        onCancel();
      }
    },
    [reset.inProgress, onCancel],
  );

  const onConfirm = useCallback(() => {
    if (!canConfirm) return;
    void reset.reset();
  }, [canConfirm, reset]);

  return (
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      aria-describedby="reset-dialog-warning"
      className="rounded-md border border-red-300 bg-red-50 p-4 text-sm dark:border-red-700 dark:bg-red-950/30"
      data-testid="reset-dialog"
      onKeyDown={onKeyDown}
    >
      <h2
        id="reset-dialog-title"
        className="mb-2 text-base font-semibold text-red-900 dark:text-red-200"
        data-testid="reset-dialog-title"
      >
        {t('dialog.title')}
      </h2>
      <p
        id="reset-dialog-warning"
        className="mb-3 text-red-900 dark:text-red-200"
        data-testid="reset-dialog-warning"
      >
        {t('dialog.warning')}
      </p>

      <label htmlFor="reset-challenge-input" className="mb-1 block text-red-900 dark:text-red-200">
        {t('dialog.challenge-prompt', { challenge: CHALLENGE_STRING })}
      </label>
      <input
        id="reset-challenge-input"
        type="text"
        value={challengeInput}
        onChange={(e) => setChallengeInput(e.target.value)}
        disabled={reset.inProgress}
        autoComplete="off"
        spellCheck={false}
        placeholder={t('dialog.challenge-placeholder', { challenge: CHALLENGE_STRING })}
        className="w-full rounded-sm border border-red-300 bg-white px-3 py-2 font-mono text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-red-700 dark:bg-gray-900 dark:text-gray-100"
        data-testid="reset-challenge-input"
      />

      {reset.blocked && (
        <p
          role="alert"
          className="mt-3 rounded-sm border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
          data-testid="reset-blocked-message"
        >
          {t('dialog.blocked')}
        </p>
      )}

      {reset.result && !reset.result.fullySucceeded && (
        <p
          role="alert"
          className="mt-3 rounded-sm border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
          data-testid="reset-partial-failure"
        >
          {t('dialog.partial-failure')}
        </p>
      )}

      {reset.inProgress && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-red-900 dark:text-red-200"
          data-testid="reset-progress"
        >
          {t('dialog.progress')}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={onCancel}
          disabled={reset.inProgress}
          className="inline-flex min-h-[44px] items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          data-testid="reset-cancel-btn"
        >
          {t('dialog.cancel-button')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="inline-flex min-h-[44px] items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="reset-confirm-btn"
        >
          {t('dialog.confirm-button')}
        </button>
      </div>
    </section>
  );
}
