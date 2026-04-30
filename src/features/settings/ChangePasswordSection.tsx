import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PasswordVisibilityToggle } from '../../ui';
import { useChangeMasterPassword } from './useChangeMasterPassword';
import type { ChangePasswordError } from './useChangeMasterPassword';

/**
 * Settings section for changing the master password (P-06).
 *
 * The form is gated by a confirmation modal because the operation is
 * security-critical and re-encrypts the entire vault. Status while
 * running shows a spinner; on done, fields clear and a success
 * message renders for ~3 seconds before returning to idle. Errors
 * stay inline; the partial-failure variant carries an extra recovery
 * hint per ADR-0018 Section 6.
 */
export function ChangePasswordSection() {
  const { t } = useTranslation('settings');
  const { status, changePassword, reset } = useChangeMasterPassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const busy = status.kind === 'verifying' || status.kind === 'reencrypting';

  // Clear the form on a successful change. Error path keeps fields so
  // the user can correct without re-typing.
  useEffect(() => {
    if (status.kind === 'done') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [status.kind]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setConfirmOpen(true);
  }

  function onConfirm() {
    setConfirmOpen(false);
    void changePassword({ currentPassword, newPassword, confirmPassword });
  }

  function onCancelConfirm() {
    setConfirmOpen(false);
  }

  function dismissResult() {
    reset();
  }

  return (
    <section aria-labelledby="change-password-heading" className="space-y-3">
      <h2
        id="change-password-heading"
        className="text-base font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('change-password.heading')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('change-password.description')}</p>

      <form className="space-y-3" onSubmit={onSubmit}>
        <PasswordInput
          id="current-password"
          label={t('change-password.field.current')}
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          disabled={busy}
        />
        <PasswordInput
          id="new-password"
          label={t('change-password.field.new')}
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          disabled={busy}
          hint={t('change-password.field.new-hint', { min: 12 })}
        />
        <PasswordInput
          id="confirm-password"
          label={t('change-password.field.confirm')}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          disabled={busy}
        />

        <button
          type="submit"
          disabled={busy || !currentPassword || !newPassword || !confirmPassword}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400 dark:disabled:bg-gray-700"
        >
          {busy ? t('change-password.action.busy') : t('change-password.action.submit')}
        </button>
      </form>

      {status.kind === 'reencrypting' && (
        <p role="status" aria-live="polite" className="text-sm text-gray-700 dark:text-gray-300">
          {t('change-password.status.reencrypting')}
        </p>
      )}

      {status.kind === 'done' && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start justify-between gap-3 rounded-sm bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300"
        >
          <span>{t('change-password.status.done')}</span>
          <button
            type="button"
            onClick={dismissResult}
            className="text-xs underline"
            aria-label={t('change-password.action.dismiss')}
          >
            {t('change-password.action.dismiss')}
          </button>
        </div>
      )}

      {status.kind === 'error' && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-sm bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{errorMessage(status.error, t)}</span>
          <button
            type="button"
            onClick={dismissResult}
            className="text-xs underline"
            aria-label={t('change-password.action.dismiss')}
          >
            {t('change-password.action.dismiss')}
          </button>
        </div>
      )}

      {confirmOpen && <ConfirmModal onConfirm={onConfirm} onCancel={onCancelConfirm} t={t} />}
    </section>
  );
}

interface PasswordInputProps {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  hint?: string;
}

function PasswordInput({
  id,
  label,
  autoComplete,
  value,
  onChange,
  disabled,
  hint,
}: PasswordInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="block w-full rounded-sm border border-gray-300 bg-white px-3 py-2 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800"
        />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
          labelShow={t('common:password-toggle.password-show')}
          labelHide={t('common:password-toggle.password-hide')}
          disabled={disabled}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

interface ConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ConfirmModal({ onConfirm, onCancel, t }: ConfirmModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900 dark:shadow-black/60"
        role="document"
      >
        <h2
          id="change-password-confirm-title"
          className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          <span aria-hidden>⚠</span> {t('change-password.confirm.heading')}
        </h2>
        <p className="mb-6 text-sm text-gray-700 dark:text-gray-300">
          {t('change-password.confirm.body')}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('common:action.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t('change-password.confirm.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}

function errorMessage(
  error: ChangePasswordError,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (error.kind) {
    case 'wrong-current':
      return t('change-password.error.wrong-current');
    case 'weak-new':
      return error.reason === 'empty'
        ? t('change-password.error.empty')
        : t('change-password.error.too-short', { min: error.min ?? 12 });
    case 'mismatch':
      return t('change-password.error.mismatch');
    case 'same-as-current':
      return t('change-password.error.same-as-current');
    case 'no-meta':
      return t('change-password.error.no-meta');
    case 'locked':
      return t('change-password.error.locked');
    case 'reencrypt-failed':
      return t('change-password.error.reencrypt-failed', { detail: error.detail });
    case 'partial-failure':
      return t('change-password.error.partial-failure');
  }
}
