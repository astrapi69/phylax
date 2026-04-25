import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui';
import type { ObservationFormState, UseObservationFormResult } from './useObservationForm';

export interface ObservationFormProps {
  /** Form-state hook result; the form is fully driven by it. */
  form: UseObservationFormResult;
}

/**
 * O-10 observation form: modal-based create + edit. Consumes the O-20
 * `<Modal>` primitive for focus trap, backdrop, portal, scroll lock.
 *
 * Layout: theme (with native datalist suggestions) + status row, then
 * the three Markdown textareas (fact / pattern / selfRegulation).
 * Optional fields (medicalFinding, relevanceNotes) live inside a
 * `<details>` disclosure — collapsed by default in create mode,
 * expanded when editing an observation that already has data in
 * either optional field (Q2).
 *
 * Submit gating: theme must be non-empty after trim. The save button
 * stays disabled otherwise. Submit error stays inside the modal (no
 * toast that would dismiss the modal first).
 */
export function ObservationForm({ form }: ObservationFormProps) {
  if (form.state.kind !== 'open') return null;
  if (form.state.mode.kind === 'delete') return null; // delete uses ConfirmDialog separately
  return <OpenForm form={form} state={form.state} />;
}

function OpenForm({
  form,
  state,
}: {
  form: UseObservationFormResult;
  state: Extract<ObservationFormState, { kind: 'open' }>;
}) {
  const { t } = useTranslation('observations');
  const titleId = useId();
  const datalistId = useId();
  const themeFieldId = useId();
  const factFieldId = useId();
  const patternFieldId = useId();
  const selfRegFieldId = useId();
  const statusFieldId = useId();
  const medFindFieldId = useId();
  const relevanceFieldId = useId();

  const isEdit = state.mode.kind === 'edit';
  const editObservation = isEdit && state.mode.kind === 'edit' ? state.mode.observation : null;
  const hasOptionalData = !!editObservation?.medicalFinding || !!editObservation?.relevanceNotes;
  const [optionalOpen, setOptionalOpen] = useState(hasOptionalData);

  // Reset optional disclosure default when the form mode changes
  // (e.g., closing one edit and opening another). Not a separate
  // useEffect on every state change — only on mode/observation change.
  useEffect(() => {
    setOptionalOpen(hasOptionalData);
  }, [hasOptionalData, state.mode.kind]);

  const themeValid = state.fields.theme.trim().length > 0;
  const submitDisabled = !themeValid || state.submitting;
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
      testId="observation-form"
    >
      <ModalHeader titleId={titleId} titleTestId="observation-form-title">
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
            <Field
              id={themeFieldId}
              label={t('form.field.theme')}
              required
              error={
                !themeValid && state.submitting === false
                  ? null
                  : null /* inline gating; no submit-time error */
              }
            >
              <input
                id={themeFieldId}
                type="text"
                value={state.fields.theme}
                onChange={(e) => form.setField('theme', e.target.value)}
                list={datalistId}
                autoComplete="off"
                placeholder={t('form.field.theme-placeholder')}
                required
                aria-required="true"
                className={inputClasses()}
                data-testid="observation-form-theme"
              />
              <datalist id={datalistId} data-testid="observation-form-theme-datalist">
                {state.themes.map((theme) => (
                  <option key={theme} value={theme} />
                ))}
              </datalist>
              {!themeValid && (
                <p
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                  data-testid="observation-form-theme-error"
                >
                  {t('form.field.theme-required')}
                </p>
              )}
            </Field>

            <Field id={statusFieldId} label={t('form.field.status')}>
              <input
                id={statusFieldId}
                type="text"
                value={state.fields.status}
                onChange={(e) => form.setField('status', e.target.value)}
                placeholder={t('form.field.status-placeholder')}
                className={inputClasses()}
                data-testid="observation-form-status"
              />
            </Field>
          </div>

          <Field id={factFieldId} label={t('form.field.fact')}>
            <textarea
              id={factFieldId}
              value={state.fields.fact}
              onChange={(e) => form.setField('fact', e.target.value)}
              rows={3}
              className={inputClasses()}
              data-testid="observation-form-fact"
            />
          </Field>

          <Field id={patternFieldId} label={t('form.field.pattern')}>
            <textarea
              id={patternFieldId}
              value={state.fields.pattern}
              onChange={(e) => form.setField('pattern', e.target.value)}
              rows={3}
              className={inputClasses()}
              data-testid="observation-form-pattern"
            />
          </Field>

          <Field id={selfRegFieldId} label={t('form.field.self-regulation')}>
            <textarea
              id={selfRegFieldId}
              value={state.fields.selfRegulation}
              onChange={(e) => form.setField('selfRegulation', e.target.value)}
              rows={3}
              className={inputClasses()}
              data-testid="observation-form-self-regulation"
            />
          </Field>

          <details
            open={optionalOpen}
            onToggle={(e) => setOptionalOpen((e.target as HTMLDetailsElement).open)}
            className="rounded-sm border border-gray-200 px-3 py-2 dark:border-gray-700"
            data-testid="observation-form-optional"
          >
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('form.optional-disclosure')}
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field id={medFindFieldId} label={t('form.field.medical-finding')}>
                <textarea
                  id={medFindFieldId}
                  value={state.fields.medicalFinding}
                  onChange={(e) => form.setField('medicalFinding', e.target.value)}
                  rows={2}
                  className={inputClasses()}
                  data-testid="observation-form-medical-finding"
                />
              </Field>
              <Field id={relevanceFieldId} label={t('form.field.relevance-notes')}>
                <textarea
                  id={relevanceFieldId}
                  value={state.fields.relevanceNotes}
                  onChange={(e) => form.setField('relevanceNotes', e.target.value)}
                  rows={2}
                  className={inputClasses()}
                  data-testid="observation-form-relevance-notes"
                />
              </Field>
            </div>
          </details>

          {state.error && (
            <p
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              data-testid="observation-form-error"
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
          data-testid="observation-form-cancel"
        >
          {t('form.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void form.submit()}
          disabled={submitDisabled}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
          data-testid="observation-form-submit"
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
  error?: string | null;
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
