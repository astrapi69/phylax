import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui';
import type { LabReportFormState, UseLabReportFormResult } from './useLabReportForm';

export interface LabReportFormProps {
  /** Form-state hook result; the form is fully driven by it. */
  form: UseLabReportFormResult;
}

/**
 * O-12a lab-report form: modal-based create + edit. Consumes the O-20
 * `<Modal>` primitive for focus trap, backdrop, portal, scroll lock.
 *
 * Layout: required `reportDate` (native `<input type="date">`) on row 1,
 * lab/doctor metadata row, then optional fields (reportNumber,
 * contextNote, overallAssessment, relevanceNotes) collapsed in a
 * `<details>` disclosure - collapsed by default in create mode,
 * expanded when editing a report that already has data in any optional
 * field.
 *
 * Submit gating: reportDate must be a valid ISO YYYY-MM-DD calendar
 * day after trim. The save button stays disabled otherwise. Submit
 * error stays inside the modal (no toast).
 */
export function LabReportForm({ form }: LabReportFormProps) {
  if (form.state.kind !== 'open') return null;
  if (form.state.mode.kind === 'delete') return null; // delete uses ConfirmDialog separately
  return <OpenForm form={form} state={form.state} />;
}

function OpenForm({
  form,
  state,
}: {
  form: UseLabReportFormResult;
  state: Extract<LabReportFormState, { kind: 'open' }>;
}) {
  const { t } = useTranslation('lab-values');
  const titleId = useId();
  const dateFieldId = useId();
  const labFieldId = useId();
  const doctorFieldId = useId();
  const reportNumberFieldId = useId();
  const contextNoteFieldId = useId();
  const overallFieldId = useId();
  const relevanceFieldId = useId();

  const isEdit = state.mode.kind === 'edit';
  const editReport = isEdit && state.mode.kind === 'edit' ? state.mode.report : null;
  const hasOptionalData =
    !!editReport?.reportNumber ||
    !!editReport?.contextNote ||
    !!editReport?.overallAssessment ||
    !!editReport?.relevanceNotes;
  const [optionalOpen, setOptionalOpen] = useState(hasOptionalData);

  useEffect(() => {
    setOptionalOpen(hasOptionalData);
  }, [hasOptionalData, state.mode.kind]);

  const dateValid = isValidIsoDate(state.fields.reportDate.trim());
  const submitDisabled = !dateValid || state.submitting;
  const titleKey = isEdit ? 'form-report.title.edit' : 'form-report.title.create';
  const saveLabel = state.submitting
    ? t('form-report.save.busy')
    : t(isEdit ? 'form-report.save.edit' : 'form-report.save.create');

  return (
    <Modal
      open
      onClose={form.close}
      titleId={titleId}
      role="dialog"
      closeOnEscape={!state.submitting}
      closeOnBackdropClick={false}
      size="lg"
      testId="lab-report-form"
    >
      <ModalHeader titleId={titleId} titleTestId="lab-report-form-title">
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
            <Field id={dateFieldId} label={t('form-report.field.date')} required>
              <input
                id={dateFieldId}
                type="date"
                value={state.fields.reportDate}
                onChange={(e) => form.setField('reportDate', e.target.value)}
                required
                aria-required="true"
                className={inputClasses()}
                data-testid="lab-report-form-date"
              />
              {!dateValid && (
                <p
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                  data-testid="lab-report-form-date-error"
                >
                  {t('form-report.field.date-required')}
                </p>
              )}
            </Field>

            <Field id={labFieldId} label={t('form-report.field.lab')}>
              <input
                id={labFieldId}
                type="text"
                value={state.fields.labName}
                onChange={(e) => form.setField('labName', e.target.value)}
                placeholder={t('form-report.field.lab-placeholder')}
                className={inputClasses()}
                data-testid="lab-report-form-lab"
              />
            </Field>
          </div>

          <Field id={doctorFieldId} label={t('form-report.field.doctor')}>
            <input
              id={doctorFieldId}
              type="text"
              value={state.fields.doctorName}
              onChange={(e) => form.setField('doctorName', e.target.value)}
              placeholder={t('form-report.field.doctor-placeholder')}
              className={inputClasses()}
              data-testid="lab-report-form-doctor"
            />
          </Field>

          <details
            open={optionalOpen}
            onToggle={(e) => setOptionalOpen((e.target as HTMLDetailsElement).open)}
            className="rounded-sm border border-gray-200 px-3 py-2 dark:border-gray-700"
            data-testid="lab-report-form-optional"
          >
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('form-report.optional-disclosure')}
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field id={reportNumberFieldId} label={t('form-report.field.report-number')}>
                <input
                  id={reportNumberFieldId}
                  type="text"
                  value={state.fields.reportNumber}
                  onChange={(e) => form.setField('reportNumber', e.target.value)}
                  className={inputClasses()}
                  data-testid="lab-report-form-report-number"
                />
              </Field>
              <Field id={contextNoteFieldId} label={t('form-report.field.context-note')}>
                <textarea
                  id={contextNoteFieldId}
                  value={state.fields.contextNote}
                  onChange={(e) => form.setField('contextNote', e.target.value)}
                  rows={2}
                  className={inputClasses()}
                  data-testid="lab-report-form-context-note"
                />
              </Field>
              <Field id={overallFieldId} label={t('form-report.field.overall-assessment')}>
                <textarea
                  id={overallFieldId}
                  value={state.fields.overallAssessment}
                  onChange={(e) => form.setField('overallAssessment', e.target.value)}
                  rows={3}
                  className={inputClasses()}
                  data-testid="lab-report-form-overall"
                />
              </Field>
              <Field id={relevanceFieldId} label={t('form-report.field.relevance-notes')}>
                <textarea
                  id={relevanceFieldId}
                  value={state.fields.relevanceNotes}
                  onChange={(e) => form.setField('relevanceNotes', e.target.value)}
                  rows={2}
                  className={inputClasses()}
                  data-testid="lab-report-form-relevance"
                />
              </Field>
            </div>
          </details>

          {state.error && (
            <p
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              data-testid="lab-report-form-error"
            >
              {t('form-report.save-error', { detail: state.error })}
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
          data-testid="lab-report-form-cancel"
        >
          {t('form-report.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void form.submit()}
          disabled={submitDisabled}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
          data-testid="lab-report-form-submit"
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

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}
