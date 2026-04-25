import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../ui';
import type { UseLabReportFormResult } from './useLabReportForm';

export interface LabReportDeleteDialogProps {
  form: UseLabReportFormResult;
}

/**
 * O-12a destructive-confirm dialog for lab-report deletion. Reads the
 * form hook's state; renders only when mode is `delete`.
 *
 * Body copy enumerates exactly what the cascade removes: the report
 * itself (with date + lab name when present) and the count of its
 * associated lab values. Three i18n keys cover the matrix:
 * - `body.with-lab-and-values`  → date + lab + count
 * - `body.with-lab`              → date + lab (no values)
 * - `body.no-lab-and-values`     → date only + count
 * - `body.no-lab`                → date only (no values)
 *
 * If the value-count lookup failed (`valueCount === -1`), falls back
 * to a count-unknown wording.
 */
export function LabReportDeleteDialog({ form }: LabReportDeleteDialogProps) {
  const { t } = useTranslation('lab-values');
  const open = form.state.kind === 'open' && form.state.mode.kind === 'delete';
  const slot =
    form.state.kind === 'open' && form.state.mode.kind === 'delete' ? form.state.mode : null;
  const submitting = form.state.kind === 'open' ? form.state.submitting : false;
  const error = form.state.kind === 'open' ? form.state.error : null;

  const body = slot ? (
    <>
      <p data-testid="lab-report-delete-message">
        {buildBodyCopy(t, slot.report.reportDate, slot.report.labName, slot.valueCount)}
      </p>
      {error && (
        <p
          role="alert"
          className="mt-2 text-red-800 dark:text-red-300"
          data-testid="lab-report-delete-error"
        >
          {t('delete-report.error')}
        </p>
      )}
    </>
  ) : null;

  return (
    <ConfirmDialog
      open={open}
      onClose={form.close}
      title={t('delete-report.title')}
      body={body}
      confirmLabel={t('delete-report.confirm')}
      cancelLabel={t('delete-report.cancel')}
      onConfirm={() => void form.confirmDelete()}
      variant="destructive"
      busy={submitting}
      busyLabel={t('delete-report.busy')}
      testId="lab-report-delete-dialog"
      cancelTestId="lab-report-delete-cancel"
      confirmTestId="lab-report-delete-confirm"
    />
  );
}

function buildBodyCopy(
  t: (key: string, vars?: Record<string, unknown>) => string,
  reportDate: string,
  labName: string | undefined,
  valueCount: number,
): string {
  const date = formatGermanDate(reportDate);
  const lab = labName?.trim() ?? '';
  const hasLab = lab.length > 0;
  const countUnknown = valueCount < 0;
  const hasValues = valueCount > 0;

  if (countUnknown) {
    return hasLab
      ? t('delete-report.body.with-lab-count-unknown', { date, lab })
      : t('delete-report.body.no-lab-count-unknown', { date });
  }

  if (hasLab && hasValues) {
    return t('delete-report.body.with-lab-and-values', { date, lab, count: valueCount });
  }
  if (hasLab) {
    return t('delete-report.body.with-lab', { date, lab });
  }
  if (hasValues) {
    return t('delete-report.body.no-lab-and-values', { date, count: valueCount });
  }
  return t('delete-report.body.no-lab', { date });
}

function formatGermanDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
