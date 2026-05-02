import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrayFieldEditor, Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui';
import type {
  ProfileBaseDataFormState,
  UseProfileBaseDataFormResult,
} from './useProfileBaseDataForm';

export interface ProfileBaseDataFormProps {
  /** Form-state hook result; the form is fully driven by it. */
  form: UseProfileBaseDataFormResult;
}

/**
 * O-16 base-data edit form. Modal-based edit only - Phylax is
 * single-profile per ADR; create/delete don't apply at the
 * profile-base-data level.
 *
 * Strict-literal scope per Q1: only the five fields named in the
 * O-16 ROADMAP line plus `lastUpdateReason` for the version
 * description. Out-of-scope baseData fields (height, weight, doctor,
 * weight history, context notes, profile type) are deferred to
 * future E-series tasks; the edit hook preserves them via spread,
 * the form doesn't expose them.
 *
 * Q4 migration: if the existing profile has `age` set without
 * `birthDate`, a legacy hint shows next to the birthDate input
 * making clear that saving a birthDate replaces the stored age.
 */
export function ProfileBaseDataForm({ form }: ProfileBaseDataFormProps) {
  if (form.state.kind !== 'open') return null;
  return <OpenForm form={form} state={form.state} />;
}

function OpenForm({
  form,
  state,
}: {
  form: UseProfileBaseDataFormResult;
  state: Extract<ProfileBaseDataFormState, { kind: 'open' }>;
}) {
  const { t } = useTranslation('profile-view');
  const titleId = useId();
  const nameFieldId = useId();
  const birthDateFieldId = useId();
  const lastUpdateReasonFieldId = useId();

  const existingProfile = state.mode.profile;
  const legacyAge = existingProfile.baseData.age;
  const hasLegacyAgeOnly =
    legacyAge !== undefined && (existingProfile.baseData.birthDate ?? '').length === 0;

  const nameValid = state.fields.name.trim().length > 0;
  const birthDateValid = isValidIsoDate(state.fields.birthDate);
  const allValid = nameValid && birthDateValid;
  const submitDisabled = !allValid || state.submitting;
  const saveLabel = state.submitting ? t('edit-form.save.busy') : t('edit-form.save.label');

  return (
    <Modal
      open
      onClose={form.close}
      titleId={titleId}
      role="dialog"
      closeOnEscape={!state.submitting}
      closeOnBackdropClick={false}
      size="lg"
      testId="profile-base-data-form"
    >
      <ModalHeader titleId={titleId} titleTestId="profile-base-data-form-title">
        {t('edit-form.title')}
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
          <Field id={nameFieldId} label={t('edit-form.field.name')} required>
            <input
              id={nameFieldId}
              type="text"
              value={state.fields.name}
              onChange={(e) => form.setField('name', e.target.value)}
              placeholder={t('edit-form.field.name-placeholder')}
              required
              aria-required="true"
              className={inputClasses()}
              data-testid="profile-base-data-form-name"
            />
            {!nameValid && (
              <p
                className="mt-1 text-xs text-red-600 dark:text-red-400"
                data-testid="profile-base-data-form-name-error"
              >
                {t('edit-form.field.name-required')}
              </p>
            )}
          </Field>

          <Field id={birthDateFieldId} label={t('edit-form.field.birth-date')}>
            <input
              id={birthDateFieldId}
              type="date"
              value={state.fields.birthDate}
              onChange={(e) => form.setField('birthDate', e.target.value)}
              className={inputClasses()}
              data-testid="profile-base-data-form-birth-date"
            />
            {!birthDateValid && state.fields.birthDate.length > 0 && (
              <p
                className="mt-1 text-xs text-red-600 dark:text-red-400"
                data-testid="profile-base-data-form-birth-date-error"
              >
                {t('edit-form.field.birth-date-invalid')}
              </p>
            )}
            {hasLegacyAgeOnly && (
              <p
                className="mt-1 text-xs text-amber-700 dark:text-amber-400"
                data-testid="profile-base-data-form-legacy-age-hint"
              >
                {t('edit-form.field.birth-date-legacy-age-hint', { age: legacyAge })}
              </p>
            )}
          </Field>

          <ArrayFieldEditor
            values={state.fields.knownDiagnoses}
            onChange={(next) => form.setField('knownDiagnoses', next)}
            label={t('edit-form.field.diagnoses')}
            placeholder={t('edit-form.field.diagnoses-placeholder')}
            addLabel={t('edit-form.field.diagnoses-add')}
            removeAriaLabel={(n) => t('edit-form.field.diagnoses-remove-aria', { row: n })}
            disabled={state.submitting}
            testIdPrefix="profile-base-data-form-diagnoses"
          />

          <ArrayFieldEditor
            values={state.fields.currentMedications}
            onChange={(next) => form.setField('currentMedications', next)}
            label={t('edit-form.field.medications')}
            placeholder={t('edit-form.field.medications-placeholder')}
            addLabel={t('edit-form.field.medications-add')}
            removeAriaLabel={(n) => t('edit-form.field.medications-remove-aria', { row: n })}
            disabled={state.submitting}
            testIdPrefix="profile-base-data-form-medications"
          />

          <ArrayFieldEditor
            values={state.fields.relevantLimitations}
            onChange={(next) => form.setField('relevantLimitations', next)}
            label={t('edit-form.field.limitations')}
            placeholder={t('edit-form.field.limitations-placeholder')}
            addLabel={t('edit-form.field.limitations-add')}
            removeAriaLabel={(n) => t('edit-form.field.limitations-remove-aria', { row: n })}
            disabled={state.submitting}
            testIdPrefix="profile-base-data-form-limitations"
          />

          <Field id={lastUpdateReasonFieldId} label={t('edit-form.field.last-update-reason')}>
            <input
              id={lastUpdateReasonFieldId}
              type="text"
              value={state.fields.lastUpdateReason}
              onChange={(e) => form.setField('lastUpdateReason', e.target.value)}
              placeholder={t('edit-form.field.last-update-reason-placeholder')}
              className={inputClasses()}
              data-testid="profile-base-data-form-reason"
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {t('edit-form.field.last-update-reason-help')}
            </p>
          </Field>

          {state.error && (
            <p
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              data-testid="profile-base-data-form-error"
            >
              {t('edit-form.save-error', { detail: state.error })}
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
          data-testid="profile-base-data-form-cancel"
        >
          {t('edit-form.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void form.submit()}
          disabled={submitDisabled}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
          data-testid="profile-base-data-form-submit"
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
  if (value.length === 0) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}
