import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui';
import type { OpenPointFormState, UseOpenPointFormResult } from './useOpenPointForm';

export interface OpenPointFormProps {
  /** Form-state hook result; the form is fully driven by it. */
  form: UseOpenPointFormResult;
}

/**
 * O-15 open-point form: modal-based create + edit. Consumes the O-20
 * `<Modal>` primitive for focus trap, backdrop, portal, scroll lock.
 *
 * Layout: required `text` row, then `context` (with profile-wide
 * datalist) + `priority` row, then `timeHorizon` row, then optional
 * `details` (Markdown textarea) collapsed under a `<details>`
 * disclosure — auto-expanded in edit mode when details has content.
 *
 * Submit gating: `text` + `context` both non-empty after trim.
 * Submit button stays disabled otherwise. Submit error stays in-modal.
 *
 * `resolved` flag is owned by the toggle path (no-modal checkbox
 * click), not the edit form. Edit-mode update patch deliberately
 * omits `resolved` so concurrent toggle + edit stays consistent.
 */
export function OpenPointForm({ form }: OpenPointFormProps) {
  if (form.state.kind !== 'open') return null;
  if (form.state.mode.kind === 'delete') return null;
  return <OpenForm form={form} state={form.state} />;
}

function OpenForm({
  form,
  state,
}: {
  form: UseOpenPointFormResult;
  state: Extract<OpenPointFormState, { kind: 'open' }>;
}) {
  const { t } = useTranslation('open-points');
  const titleId = useId();
  const textFieldId = useId();
  const contextFieldId = useId();
  const contextListId = useId();
  const priorityFieldId = useId();
  const timeHorizonFieldId = useId();
  const detailsFieldId = useId();

  const isEdit = state.mode.kind === 'edit';
  const editPoint = isEdit && state.mode.kind === 'edit' ? state.mode.point : null;
  const hasOptionalData = !!editPoint?.details;
  const [optionalOpen, setOptionalOpen] = useState(hasOptionalData);

  useEffect(() => {
    setOptionalOpen(hasOptionalData);
  }, [hasOptionalData, state.mode.kind]);

  const textValid = state.fields.text.trim().length > 0;
  const contextValid = state.fields.context.trim().length > 0;
  const allValid = textValid && contextValid;
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
      testId="open-point-form"
    >
      <ModalHeader titleId={titleId} titleTestId="open-point-form-title">
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
          <Field id={textFieldId} label={t('form.field.text')} required>
            <input
              id={textFieldId}
              type="text"
              value={state.fields.text}
              onChange={(e) => form.setField('text', e.target.value)}
              placeholder={t('form.field.text-placeholder')}
              required
              aria-required="true"
              className={inputClasses()}
              data-testid="open-point-form-text"
            />
            {!textValid && (
              <p
                className="mt-1 text-xs text-red-600 dark:text-red-400"
                data-testid="open-point-form-text-error"
              >
                {t('form.field.text-required')}
              </p>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={contextFieldId} label={t('form.field.context')} required>
              <input
                id={contextFieldId}
                type="text"
                value={state.fields.context}
                onChange={(e) => form.setField('context', e.target.value)}
                list={contextListId}
                autoComplete="off"
                placeholder={t('form.field.context-placeholder')}
                required
                aria-required="true"
                className={inputClasses()}
                data-testid="open-point-form-context"
              />
              <datalist id={contextListId} data-testid="open-point-form-context-datalist">
                {state.contexts.map((ctx) => (
                  <option key={ctx} value={ctx} />
                ))}
              </datalist>
              {!contextValid && (
                <p
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                  data-testid="open-point-form-context-error"
                >
                  {t('form.field.context-required')}
                </p>
              )}
            </Field>

            <Field id={priorityFieldId} label={t('form.field.priority')}>
              <input
                id={priorityFieldId}
                type="text"
                value={state.fields.priority}
                onChange={(e) => form.setField('priority', e.target.value)}
                placeholder={t('form.field.priority-placeholder')}
                className={inputClasses()}
                data-testid="open-point-form-priority"
              />
            </Field>
          </div>

          <Field id={timeHorizonFieldId} label={t('form.field.time-horizon')}>
            <input
              id={timeHorizonFieldId}
              type="text"
              value={state.fields.timeHorizon}
              onChange={(e) => form.setField('timeHorizon', e.target.value)}
              placeholder={t('form.field.time-horizon-placeholder')}
              className={inputClasses()}
              data-testid="open-point-form-time-horizon"
            />
          </Field>

          <details
            open={optionalOpen}
            onToggle={(e) => setOptionalOpen((e.target as HTMLDetailsElement).open)}
            className="rounded-sm border border-gray-200 px-3 py-2 dark:border-gray-700"
            data-testid="open-point-form-optional"
          >
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('form.optional-disclosure')}
            </summary>
            <div className="mt-3">
              <Field id={detailsFieldId} label={t('form.field.details')}>
                <textarea
                  id={detailsFieldId}
                  value={state.fields.details}
                  onChange={(e) => form.setField('details', e.target.value)}
                  rows={3}
                  placeholder={t('form.field.details-placeholder')}
                  className={inputClasses()}
                  data-testid="open-point-form-details"
                />
              </Field>
            </div>
          </details>

          {state.error && (
            <p
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              data-testid="open-point-form-error"
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
          data-testid="open-point-form-cancel"
        >
          {t('form.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void form.submit()}
          disabled={submitDisabled}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
          data-testid="open-point-form-submit"
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
