import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui';
import { useSoftReset } from './useSoftReset';

const TITLE_ID = 'soft-reset-dialog-title';
const DESCRIPTION_ID = 'soft-reset-dialog-warning';
const INPUT_ID = 'soft-reset-challenge-input';

export interface SoftResetDialogProps {
  /** Closes the dialog without resetting (idle / done states). */
  onCancel: () => void;
  /**
   * Called once the soft reset finishes. `success === true` when
   * `useSoftReset.result.fullySucceeded` is true; the caller is
   * responsible for navigation (typically `navigate('/profile/create',
   * { replace: true })` via React Router) when success.
   */
  onSubmitted: (success: boolean) => void;
}

/**
 * Soft-reset confirmation dialog. Sibling to `ResetDialog` (hard
 * reset) per the four-Q-lock review:
 *
 * - Same DangerZoneSection placement (two-button stack: soft above
 *   hard).
 * - Lower-friction-but-not-silent confirmation: type-`LOESCHEN`
 *   (DE) / `CLEAR` (EN). Locale-aware challenge value via
 *   `t('reset:soft.challenge')`, distinct from hard reset's TS
 *   constant `RESET` (which stays English-only by ADR rationale).
 * - Two visually-distinct lists below the heading: what is wiped
 *   (8 items, ✗) and what is kept (4 items, ✓). Translation-
 *   friendly (i18n arrays via `returnObjects: true`).
 * - No blocked-state UI: `useSoftReset` uses Dexie
 *   `transaction.clear()` not `indexedDB.deleteDatabase()`, so the
 *   multi-tab block event never fires.
 * - Cancel-focused on mount (matches `ResetDialog`).
 * - ESC + Cancel + backdrop suppressed during run.
 *
 * Spec: `docs/decisions/ADR-0023-soft-reset.md` (queued for
 * Step 5; not yet written).
 */
export function SoftResetDialog({ onCancel, onSubmitted }: SoftResetDialogProps) {
  const { t } = useTranslation('reset');
  const challenge = t('soft.challenge');
  const [challengeInput, setChallengeInput] = useState('');
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const reset = useSoftReset();

  const matches = challengeInput === challenge;
  const canConfirm = matches && !reset.inProgress;
  const completedSuccessfully = reset.result?.fullySucceeded === true;
  const partialFailure = reset.result !== null && !reset.result.fullySucceeded;

  const onConfirm = useCallback(async () => {
    if (!canConfirm) return;
    await reset.softReset();
  }, [canConfirm, reset]);

  // After the wipe completes successfully, propagate the result to
  // the caller so it can navigate (or stay in the dialog showing
  // partial failure for retry). Effect runs once per result change;
  // `notifiedRef` guards against duplicate invocations on re-render.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (completedSuccessfully && !notifiedRef.current) {
      notifiedRef.current = true;
      onSubmitted(true);
    }
  }, [completedSuccessfully, onSubmitted]);

  const wiped = t('soft.wiped', { returnObjects: true }) as string[];
  const kept = t('soft.kept', { returnObjects: true }) as string[];

  return (
    <Modal
      open
      onClose={onCancel}
      titleId={TITLE_ID}
      descriptionId={DESCRIPTION_ID}
      role="alertdialog"
      closeOnEscape={!reset.inProgress}
      closeOnBackdropClick={false}
      initialFocusRef={cancelButtonRef}
      size="md"
      testId="soft-reset-dialog"
    >
      <ModalHeader titleId={TITLE_ID} titleTestId={TITLE_ID}>
        {t('soft.title')}
      </ModalHeader>
      <ModalBody>
        <div id={DESCRIPTION_ID} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div data-testid="soft-reset-wiped-list">
              <p className="mb-2 text-sm font-semibold text-red-900 dark:text-red-200">
                {t('soft.warning-intro')}
              </p>
              <ul className="space-y-1 text-sm text-red-900 dark:text-red-200">
                {wiped.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span aria-hidden className="font-bold">
                      ✗
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div data-testid="soft-reset-kept-list">
              <p className="mb-2 text-sm font-semibold text-green-900 dark:text-green-200">
                {t('soft.warning-kept-intro')}
              </p>
              <ul className="space-y-1 text-sm text-green-900 dark:text-green-200">
                {kept.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span aria-hidden className="font-bold">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <label
              htmlFor={INPUT_ID}
              className="mt-1 mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200"
            >
              {t('soft.challenge-prompt', { challenge })}
            </label>
            <input
              id={INPUT_ID}
              type="text"
              value={challengeInput}
              onChange={(e) => setChallengeInput(e.target.value)}
              disabled={reset.inProgress || completedSuccessfully}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('soft.challenge-placeholder', { challenge })}
              className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 font-mono text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              data-testid="soft-reset-challenge-input"
            />
          </div>

          {partialFailure && (
            <p
              role="alert"
              className="rounded-sm border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
              data-testid="soft-reset-partial-failure"
            >
              {t('soft.partial-failure')}
            </p>
          )}

          {reset.inProgress && (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-gray-800 dark:text-gray-200"
              data-testid="soft-reset-progress"
            >
              {t('soft.progress')}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={onCancel}
          disabled={reset.inProgress}
          className="inline-flex min-h-[44px] items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          data-testid="soft-reset-cancel-btn"
        >
          {t('soft.cancel-button')}
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={!canConfirm || completedSuccessfully}
          className="inline-flex min-h-[44px] items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="soft-reset-confirm-btn"
        >
          {t('soft.confirm-button')}
        </button>
      </ModalFooter>
    </Modal>
  );
}
