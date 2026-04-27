import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../ui';
import type { OpenPoint } from '../../domain';
import type { UseOpenPointFormResult } from './useOpenPointForm';

export interface OpenPointDeleteDialogProps {
  form: UseOpenPointFormResult;
}

const TEXT_PREVIEW_MAX = 50;

/**
 * O-15 destructive-confirm dialog for open-point deletion. Reads the
 * form hook's state; renders only when mode is `delete`.
 *
 * Body copy shows the truncated text + context so users can tell
 * which item is being deleted, mirroring O-12b's parameter+result
 * pattern. Two body keys:
 * - `delete.body.with-context`: text + context
 * - `delete.body.no-context`: text only (defensive — context is
 *   required so empty shouldn't normally happen)
 */
export function OpenPointDeleteDialog({ form }: OpenPointDeleteDialogProps) {
  const { t } = useTranslation('open-points');
  const open = form.state.kind === 'open' && form.state.mode.kind === 'delete';
  const point =
    form.state.kind === 'open' && form.state.mode.kind === 'delete'
      ? form.state.mode.point
      : null;
  const submitting = form.state.kind === 'open' ? form.state.submitting : false;
  const error = form.state.kind === 'open' ? form.state.error : null;

  const body = point ? (
    <>
      <p data-testid="open-point-delete-message">{buildBodyCopy(t, point)}</p>
      {error && (
        <p
          role="alert"
          className="mt-2 text-red-800 dark:text-red-300"
          data-testid="open-point-delete-error"
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
      testId="open-point-delete-dialog"
      cancelTestId="open-point-delete-cancel"
      confirmTestId="open-point-delete-confirm"
    />
  );
}

function buildBodyCopy(
  t: (key: string, vars?: Record<string, unknown>) => string,
  point: OpenPoint,
): string {
  const text = truncate(point.text);
  const context = point.context.trim();
  if (context.length > 0) {
    return t('delete.body.with-context', { text, context });
  }
  return t('delete.body.no-context', { text });
}

function truncate(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= TEXT_PREVIEW_MAX) return collapsed;
  return `${collapsed.slice(0, TEXT_PREVIEW_MAX - 1)}…`;
}
