import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui';
import type { SupplementCategory } from '../../domain';
import type { SupplementFormState, UseSupplementFormResult } from './useSupplementForm';

export interface SupplementFormProps {
  /** Form-state hook result; the form is fully driven by it. */
  form: UseSupplementFormResult;
}

/**
 * O-14 supplement form: modal-based create + edit. Consumes the O-20
 * `<Modal>` primitive for focus trap, backdrop, portal, scroll lock.
 *
 * Layout: 5 fields flat (no `<details>` disclosure - total field count
 * is small enough to keep visible). Required: `name` + `category`.
 * Optional: `brand`, `recommendation`, `rationale`.
 *
 * Category control: native `<select>` with a non-submittable
 * placeholder option (`disabled`, `value=""`). Submit gates on
 * `category !== ''` plus `name.trim() !== ''`. Empty category default
 * is intentional per Q5: category is a classification field where a
 * silent default would risk miscategorization the user notices much
 * later.
 */
const CATEGORIES: readonly SupplementCategory[] = [
  'daily',
  'regular',
  'on-demand',
  'paused',
] as const;

export function SupplementForm({ form }: SupplementFormProps) {
  if (form.state.kind !== 'open') return null;
  if (form.state.mode.kind === 'delete') return null;
  return <OpenForm form={form} state={form.state} />;
}

function OpenForm({
  form,
  state,
}: {
  form: UseSupplementFormResult;
  state: Extract<SupplementFormState, { kind: 'open' }>;
}) {
  const { t } = useTranslation('supplements');
  const titleId = useId();
  const nameFieldId = useId();
  const brandFieldId = useId();
  const categoryFieldId = useId();
  const recommendationFieldId = useId();
  const rationaleFieldId = useId();

  const isEdit = state.mode.kind === 'edit';
  const nameValid = state.fields.name.trim().length > 0;
  const categoryValid = state.fields.category !== '';
  const allValid = nameValid && categoryValid;
  const submitDisabled = !allValid || state.submitting;
  const titleKey = isEdit ? 'form.title.edit' : 'form.title.create';
  const saveLabel = state.submitting
    ? t('form.save.busy')
    : t(isEdit ? 'form.save.edit' : 'form.save.create');

  return (
    <Modal
      open
      onClose={form.close}
      titleId={titleId}
      role="dialog"
      closeOnEscape={!state.submitting}
      closeOnBackdropClick={false}
      size="lg"
      testId="supplement-form"
    >
      <ModalHeader titleId={titleId} titleTestId="supplement-form-title">
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
            <Field id={nameFieldId} label={t('form.field.name')} required>
              <input
                id={nameFieldId}
                type="text"
                value={state.fields.name}
                onChange={(e) => form.setField('name', e.target.value)}
                placeholder={t('form.field.name-placeholder')}
                required
                aria-required="true"
                className={inputClasses()}
                data-testid="supplement-form-name"
              />
              {!nameValid && (
                <p
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                  data-testid="supplement-form-name-error"
                >
                  {t('form.field.name-required')}
                </p>
              )}
            </Field>

            <Field id={brandFieldId} label={t('form.field.brand')}>
              <input
                id={brandFieldId}
                type="text"
                value={state.fields.brand}
                onChange={(e) => form.setField('brand', e.target.value)}
                placeholder={t('form.field.brand-placeholder')}
                className={inputClasses()}
                data-testid="supplement-form-brand"
              />
            </Field>
          </div>

          <Field id={categoryFieldId} label={t('form.field.category')} required>
            <select
              id={categoryFieldId}
              value={state.fields.category}
              onChange={(e) => form.setField('category', e.target.value as SupplementCategory | '')}
              required
              aria-required="true"
              className={inputClasses()}
              data-testid="supplement-form-category"
            >
              <option value="" disabled>
                {t('form.field.category-placeholder')}
              </option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`category.${cat}`)}
                </option>
              ))}
            </select>
            {!categoryValid && (
              <p
                className="mt-1 text-xs text-red-600 dark:text-red-400"
                data-testid="supplement-form-category-error"
              >
                {t('form.field.category-required')}
              </p>
            )}
          </Field>

          <Field id={recommendationFieldId} label={t('form.field.recommendation')}>
            <input
              id={recommendationFieldId}
              type="text"
              value={state.fields.recommendation}
              onChange={(e) => form.setField('recommendation', e.target.value)}
              placeholder={t('form.field.recommendation-placeholder')}
              className={inputClasses()}
              data-testid="supplement-form-recommendation"
            />
          </Field>

          <Field id={rationaleFieldId} label={t('form.field.rationale')}>
            <textarea
              id={rationaleFieldId}
              value={state.fields.rationale}
              onChange={(e) => form.setField('rationale', e.target.value)}
              rows={2}
              placeholder={t('form.field.rationale-placeholder')}
              className={inputClasses()}
              data-testid="supplement-form-rationale"
            />
          </Field>

          {state.error && (
            <p
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              data-testid="supplement-form-error"
            >
              {t('form.save-error', { detail: state.error })}
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
          data-testid="supplement-form-cancel"
        >
          {t('form.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void form.submit()}
          disabled={submitDisabled}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
          data-testid="supplement-form-submit"
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
