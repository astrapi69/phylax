import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../ui';
import type { LabValue } from '../../domain';
import type { UseLabValueFormResult } from './useLabValueForm';

export interface LabValueDeleteDialogProps {
  form: UseLabValueFormResult;
}

/**
 * O-12b destructive-confirm dialog for lab-value deletion. Reads the
 * form hook's state; renders only when mode is `delete`.
 *
 * Body copy shows parameter + result, with optional unit. A single
 * value has no children, so no cascade enumeration is needed; the
 * copy stays simple ("Kreatinin = 1.2 mg/dl wirklich löschen?").
 */
export function LabValueDeleteDialog({ form }: LabValueDeleteDialogProps) {
  const { t } = useTranslation('lab-values');
  const open = form.state.kind === 'open' && form.state.mode.kind === 'delete';
  const value =
    form.state.kind === 'open' && form.state.mode.kind === 'delete' ? form.state.mode.value : null;
  const submitting = form.state.kind === 'open' ? form.state.submitting : false;
  const error = form.state.kind === 'open' ? form.state.error : null;

  const body = value ? (
    <>
      <p data-testid="lab-value-delete-message">{buildBodyCopy(t, value)}</p>
      {error && (
        <p
          role="alert"
          className="mt-2 text-red-800 dark:text-red-300"
          data-testid="lab-value-delete-error"
        >
          {t('delete-value.error')}
        </p>
      )}
    </>
  ) : null;

  return (
    <ConfirmDialog
      open={open}
      onClose={form.close}
      title={t('delete-value.title')}
      body={body}
      confirmLabel={t('delete-value.confirm')}
      cancelLabel={t('delete-value.cancel')}
      onConfirm={() => void form.confirmDelete()}
      variant="destructive"
      busy={submitting}
      busyLabel={t('delete-value.busy')}
      testId="lab-value-delete-dialog"
      cancelTestId="lab-value-delete-cancel"
      confirmTestId="lab-value-delete-confirm"
    />
  );
}

function buildBodyCopy(
  t: (key: string, vars?: Record<string, unknown>) => string,
  value: LabValue,
): string {
  const unit = value.unit?.trim() ?? '';
  if (unit.length > 0) {
    return t('delete-value.body.with-unit', {
      parameter: value.parameter,
      result: value.result,
      unit,
    });
  }
  return t('delete-value.body.no-unit', {
    parameter: value.parameter,
    result: value.result,
  });
}
