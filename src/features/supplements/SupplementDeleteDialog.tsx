import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../ui';
import type { Supplement } from '../../domain';
import type { UseSupplementFormResult } from './useSupplementForm';

export interface SupplementDeleteDialogProps {
  form: UseSupplementFormResult;
}

/**
 * O-14 destructive-confirm dialog for supplement deletion. Reads the
 * form hook's state; renders only when mode is `delete`.
 *
 * Body copy includes brand when present so users with multiple
 * products under the same name (e.g. several Magnesium brands) can
 * tell which one is being removed. Two body keys (`with-brand` /
 * `no-brand`), mirrors O-12b's `with-unit` / `no-unit` pattern.
 */
export function SupplementDeleteDialog({ form }: SupplementDeleteDialogProps) {
  const { t } = useTranslation('supplements');
  const open = form.state.kind === 'open' && form.state.mode.kind === 'delete';
  const supplement =
    form.state.kind === 'open' && form.state.mode.kind === 'delete'
      ? form.state.mode.supplement
      : null;
  const submitting = form.state.kind === 'open' ? form.state.submitting : false;
  const error = form.state.kind === 'open' ? form.state.error : null;

  const body = supplement ? (
    <>
      <p data-testid="supplement-delete-message">{buildBodyCopy(t, supplement)}</p>
      {error && (
        <p
          role="alert"
          className="mt-2 text-red-800 dark:text-red-300"
          data-testid="supplement-delete-error"
        >
          {t('delete.error')}
        </p>
      )}
    </>
  ) : null;

  return (
    <ConfirmDialog
      open={open}
      onClose={form.close}
      title={t('delete.title')}
      body={body}
      confirmLabel={t('delete.confirm')}
      cancelLabel={t('delete.cancel')}
      onConfirm={() => void form.confirmDelete()}
      variant="destructive"
      busy={submitting}
      busyLabel={t('delete.busy')}
      testId="supplement-delete-dialog"
      cancelTestId="supplement-delete-cancel"
      confirmTestId="supplement-delete-confirm"
    />
  );
}

function buildBodyCopy(
  t: (key: string, vars?: Record<string, unknown>) => string,
  supplement: Supplement,
): string {
  const brand = supplement.brand?.trim() ?? '';
  if (brand.length > 0) {
    return t('delete.body.with-brand', { name: supplement.name, brand });
  }
  return t('delete.body.no-brand', { name: supplement.name });
}
