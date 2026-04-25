import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui';
import type { LabValueFormState, UseLabValueFormResult } from './useLabValueForm';

export interface LabValueFormProps {
  /** Form-state hook result; the form is fully driven by it. */
  form: UseLabValueFormResult;
}

/**
 * O-12b lab-value form: modal-based create + edit. Consumes the O-20
 * `<Modal>` primitive for focus trap, backdrop, portal, scroll lock.
 *
 * Layout: 3 rows of 2 columns on sm+. Required fields (category +
 * parameter, result) gate submit; unit / referenceRange / assessment
 * are optional. All six fields visible without disclosure since the
 * total field count is small enough to avoid the second-thought-click
 * pattern that justified `<details>` on `LabReportForm`.
 *
 * Datalists:
 * - parameter: profile-wide, German-collated, refreshed on open.
 * - category: scoped to the active report's existing categories,
 *   refreshed on open. Re-categorization in edit mode is allowed and
 *   the parent table re-groups on commit.
 * - assessment: fixed suggestions ("normal", "erhöht", "erniedrigt",
 *   "kritisch") with free-text fallback.
 */
const ASSESSMENT_SUGGESTIONS = ['normal', 'erhöht', 'erniedrigt', 'kritisch'] as const;

export function LabValueForm({ form }: LabValueFormProps) {
  if (form.state.kind !== 'open') return null;
  if (form.state.mode.kind === 'delete') return null;
  return <OpenForm form={form} state={form.state} />;
}

function OpenForm({
  form,
  state,
}: {
  form: UseLabValueFormResult;
  state: Extract<LabValueFormState, { kind: 'open' }>;
}) {
  const { t } = useTranslation('lab-values');
  const titleId = useId();
  const categoryFieldId = useId();
  const categoryListId = useId();
  const parameterFieldId = useId();
  const parameterListId = useId();
  const resultFieldId = useId();
  const unitFieldId = useId();
  const refRangeFieldId = useId();
  const assessmentFieldId = useId();
  const assessmentListId = useId();

  const isEdit = state.mode.kind === 'edit';
  const categoryValid = state.fields.category.trim().length > 0;
  const parameterValid = state.fields.parameter.trim().length > 0;
  const resultValid = state.fields.result.trim().length > 0;
  const allValid = categoryValid && parameterValid && resultValid;
  const submitDisabled = !allValid || state.submitting;
  const titleKey = isEdit ? 'form-value.title.edit' : 'form-value.title.create';
  const saveLabel = state.submitting
    ? t('form-value.save.busy')
    : t(isEdit ? 'form-value.save.edit' : 'form-value.save.create');

  return (
    <Modal
      open
      onClose={form.close}
      titleId={titleId}
      role="dialog"
      closeOnEscape={!state.submitting}
      closeOnBackdropClick={false}
      size="lg"
      testId="lab-value-form"
    >
      <ModalHeader titleId={titleId} titleTestId="lab-value-form-title">
        {t(titleKey)}
      </ModalHeader>
      <ModalBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.submit();
          }}
          className="flex flex-col gap-4"
          aria-labelledby={titleId}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={categoryFieldId} label={t('form-value.field.category')} required>
              <input
                id={categoryFieldId}
                type="text"
                value={state.fields.category}
                onChange={(e) => form.setField('category', e.target.value)}
                list={categoryListId}
                autoComplete="off"
                placeholder={t('form-value.field.category-placeholder')}
                required
                aria-required="true"
                className={inputClasses()}
                data-testid="lab-value-form-category"
              />
              <datalist id={categoryListId} data-testid="lab-value-form-category-datalist">
                {state.categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {!categoryValid && (
                <p
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                  data-testid="lab-value-form-category-error"
                >
                  {t('form-value.field.category-required')}
                </p>
              )}
            </Field>

            <Field id={parameterFieldId} label={t('form-value.field.parameter')} required>
              <input
                id={parameterFieldId}
                type="text"
                value={state.fields.parameter}
                onChange={(e) => form.setField('parameter', e.target.value)}
                list={parameterListId}
                autoComplete="off"
                placeholder={t('form-value.field.parameter-placeholder')}
                required
                aria-required="true"
                className={inputClasses()}
                data-testid="lab-value-form-parameter"
              />
              <datalist id={parameterListId} data-testid="lab-value-form-parameter-datalist">
                {state.parameters.map((param) => (
                  <option key={param} value={param} />
                ))}
              </datalist>
              {!parameterValid && (
                <p
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                  data-testid="lab-value-form-parameter-error"
                >
                  {t('form-value.field.parameter-required')}
                </p>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={resultFieldId} label={t('form-value.field.result')} required>
              <input
                id={resultFieldId}
                type="text"
                value={state.fields.result}
                onChange={(e) => form.setField('result', e.target.value)}
                placeholder={t('form-value.field.result-placeholder')}
                required
                aria-required="true"
                className={inputClasses()}
                data-testid="lab-value-form-result"
              />
              {!resultValid && (
                <p
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                  data-testid="lab-value-form-result-error"
                >
                  {t('form-value.field.result-required')}
                </p>
              )}
            </Field>

            <Field id={unitFieldId} label={t('form-value.field.unit')}>
              <input
                id={unitFieldId}
                type="text"
                value={state.fields.unit}
                onChange={(e) => form.setField('unit', e.target.value)}
                placeholder={t('form-value.field.unit-placeholder')}
                className={inputClasses()}
                data-testid="lab-value-form-unit"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={refRangeFieldId} label={t('form-value.field.reference-range')}>
              <input
                id={refRangeFieldId}
                type="text"
                value={state.fields.referenceRange}
                onChange={(e) => form.setField('referenceRange', e.target.value)}
                placeholder={t('form-value.field.reference-range-placeholder')}
                className={inputClasses()}
                data-testid="lab-value-form-reference-range"
              />
            </Field>

            <Field id={assessmentFieldId} label={t('form-value.field.assessment')}>
              <input
                id={assessmentFieldId}
                type="text"
                value={state.fields.assessment}
                onChange={(e) => form.setField('assessment', e.target.value)}
                list={assessmentListId}
                autoComplete="off"
                placeholder={t('form-value.field.assessment-placeholder')}
                className={inputClasses()}
                data-testid="lab-value-form-assessment"
              />
              <datalist id={assessmentListId} data-testid="lab-value-form-assessment-datalist">
                {ASSESSMENT_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>

          {state.error && (
            <p
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              data-testid="lab-value-form-error"
            >
              {t('form-value.save-error', { detail: state.error })}
            </p>
          )}
        </form>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={form.close}
          disabled={state.submitting}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          data-testid="lab-value-form-cancel"
        >
          {t('form-value.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void form.submit()}
          disabled={submitDisabled}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
          data-testid="lab-value-form-submit"
        >
          {saveLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ id, label, required, children }: FieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
      <span className="font-medium">
        {label}
        {required ? (
          <span aria-hidden className="ml-1 text-red-600 dark:text-red-400">
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function inputClasses(): string {
  return 'rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
}
