import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../ui';
import type { UseObservationFormResult } from './useObservationForm';

export interface ObservationDeleteDialogProps {
  form: UseObservationFormResult;
}

const FACT_PREVIEW_MAX = 50;

/**
 * O-10 destructive-confirm dialog for observation deletion. Reads
 * the form hook's state; renders only when mode is `delete`.
 *
 * Body copy uses two distinct keys (Q4): theme-only when fact is
 * empty, theme + truncated fact preview when fact has content.
 * Fact preview strips Markdown formatting and collapses newlines so
 * the dialog stays plain-text and single-line.
 */
export function ObservationDeleteDialog({ form }: ObservationDeleteDialogProps) {
  const { t } = useTranslation('observations');
  const open = form.state.kind === 'open' && form.state.mode.kind === 'delete';
  const observation =
    form.state.kind === 'open' && form.state.mode.kind === 'delete'
      ? form.state.mode.observation
      : null;
  const submitting = form.state.kind === 'open' ? form.state.submitting : false;
  const error = form.state.kind === 'open' ? form.state.error : null;

  const factPreview = observation ? buildFactPreview(observation.fact) : '';
  const body = observation ? (
    <>
      <p data-testid="observation-delete-message">
        {factPreview.length > 0
          ? t('delete.body-with-fact', { theme: observation.theme, fact: factPreview })
          : t('delete.body', { theme: observation.theme })}
      </p>
      {error && (
        <p
          role="alert"
          className="mt-2 text-red-800 dark:text-red-300"
          data-testid="observation-delete-error"
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
      testId="observation-delete-dialog"
      cancelTestId="observation-delete-cancel"
      confirmTestId="observation-delete-confirm"
    />
  );
}

/**
 * Build a plain-text single-line preview of `fact` for the delete
 * confirmation copy. Strips common Markdown (bold/italic/headers/
 * bullets/links), collapses whitespace + newlines, truncates to
 * `FACT_PREVIEW_MAX` chars with an ellipsis.
 */
function buildFactPreview(fact: string): string {
  if (!fact) return '';
  const stripped = fact
    // Strip Markdown emphasis/code/links/headers/bullets
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // images + links → label
    .replace(/`+/g, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^[#>*\-+\s]+/gm, '')
    // Collapse newlines + runs of whitespace
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= FACT_PREVIEW_MAX) return stripped;
  return `${stripped.slice(0, FACT_PREVIEW_MAX - 1)}…`;
}
