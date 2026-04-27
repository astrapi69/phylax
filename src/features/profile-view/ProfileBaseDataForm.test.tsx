import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { ProfileBaseDataForm } from './ProfileBaseDataForm';
import type {
  ProfileBaseDataFormState,
  UseProfileBaseDataFormResult,
} from './useProfileBaseDataForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeProfile } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(
  overrides: Partial<UseProfileBaseDataFormResult> = {},
): UseProfileBaseDataFormResult {
  const profile = makeProfile();
  const state: ProfileBaseDataFormState = overrides.state ?? {
    kind: 'open',
    mode: { kind: 'edit', profile },
    fields: {
      name: profile.baseData.name ?? '',
      birthDate: '',
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      lastUpdateReason: '',
    },
    submitting: false,
    error: null,
  };
  return {
    state,
    openEdit: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

function openState(extras: Partial<Extract<ProfileBaseDataFormState, { kind: 'open' }>> = {}) {
  const profile = extras.mode?.profile ?? makeProfile();
  return {
    kind: 'open' as const,
    mode: extras.mode ?? { kind: 'edit' as const, profile },
    fields: extras.fields ?? {
      name: profile.baseData.name ?? '',
      birthDate: '',
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      lastUpdateReason: '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
  };
}

describe('ProfileBaseDataForm', () => {
  it('renders nothing when state is closed', () => {
    const form = makeForm({ state: { kind: 'closed' } });
    const { container } = render(<ProfileBaseDataForm form={form} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title + prefilled fields in edit mode', () => {
    const profile = makeProfile({
      baseData: {
        name: 'Bea',
        birthDate: '1980-05-12',
        weightHistory: [],
        knownDiagnoses: ['Hypertonie'],
        currentMedications: ['Ramipril'],
        relevantLimitations: [],
        profileType: 'self',
      },
    });
    const form = makeForm({
      state: openState({
        mode: { kind: 'edit', profile },
        fields: {
          name: 'Bea',
          birthDate: '1980-05-12',
          knownDiagnoses: ['Hypertonie'],
          currentMedications: ['Ramipril'],
          relevantLimitations: [],
          lastUpdateReason: '',
        },
      }),
    });
    render(<ProfileBaseDataForm form={form} />);
    expect(screen.getByTestId('profile-base-data-form-title')).toHaveTextContent(
      'Basisdaten bearbeiten',
    );
    expect(screen.getByTestId('profile-base-data-form-name')).toHaveValue('Bea');
    expect(screen.getByTestId('profile-base-data-form-birth-date')).toHaveValue('1980-05-12');
    expect(screen.getByTestId('profile-base-data-form-diagnoses-input-0')).toHaveValue('Hypertonie');
    expect(screen.getByTestId('profile-base-data-form-medications-input-0')).toHaveValue('Ramipril');
  });

  it('disables submit when name is empty', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: '',
          birthDate: '',
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          lastUpdateReason: '',
        },
      }),
    });
    render(<ProfileBaseDataForm form={form} />);
    expect(screen.getByTestId('profile-base-data-form-submit')).toBeDisabled();
    expect(screen.getByTestId('profile-base-data-form-name-error')).toHaveTextContent(
      'Name ist erforderlich',
    );
  });

  it('disables submit when birthDate is malformed', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: 'Anna',
          birthDate: '12.05.1980',
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          lastUpdateReason: '',
        },
      }),
    });
    render(<ProfileBaseDataForm form={form} />);
    expect(screen.getByTestId('profile-base-data-form-submit')).toBeDisabled();
    expect(screen.getByTestId('profile-base-data-form-birth-date-error')).toBeInTheDocument();
  });

  it('shows legacy-age hint when profile has age but no birthDate (Q4 migration)', () => {
    const profile = makeProfile({
      baseData: {
        name: 'Carl',
        age: 47,
        birthDate: undefined,
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
    });
    const form = makeForm({
      state: openState({
        mode: { kind: 'edit', profile },
        fields: {
          name: 'Carl',
          birthDate: '',
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          lastUpdateReason: '',
        },
      }),
    });
    render(<ProfileBaseDataForm form={form} />);
    const hint = screen.getByTestId('profile-base-data-form-legacy-age-hint');
    expect(hint).toHaveTextContent('Bisher (wird durch Geburtsdatum ersetzt): 47 Jahre');
  });

  it('does NOT show legacy-age hint when profile already has birthDate', () => {
    const profile = makeProfile({
      baseData: {
        name: 'Eva',
        age: 47,
        birthDate: '1978-01-01',
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
    });
    const form = makeForm({
      state: openState({
        mode: { kind: 'edit', profile },
        fields: {
          name: 'Eva',
          birthDate: '1978-01-01',
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          lastUpdateReason: '',
        },
      }),
    });
    render(<ProfileBaseDataForm form={form} />);
    expect(screen.queryByTestId('profile-base-data-form-legacy-age-hint')).toBeNull();
  });

  it('typing in name field calls setField', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    render(<ProfileBaseDataForm form={makeForm({ setField })} />);
    await user.type(screen.getByTestId('profile-base-data-form-name'), 'X');
    expect(setField).toHaveBeenCalledWith('name', 'Mein ProfilX');
  });

  it('renders three array editors (diagnoses, medications, limitations)', () => {
    render(<ProfileBaseDataForm form={makeForm()} />);
    expect(screen.getByTestId('profile-base-data-form-diagnoses-add')).toBeInTheDocument();
    expect(screen.getByTestId('profile-base-data-form-medications-add')).toBeInTheDocument();
    expect(screen.getByTestId('profile-base-data-form-limitations-add')).toBeInTheDocument();
  });

  it('clicking submit calls form.submit when valid', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    render(<ProfileBaseDataForm form={makeForm({ submit })} />);
    await user.click(screen.getByTestId('profile-base-data-form-submit'));
    expect(submit).toHaveBeenCalled();
  });

  it('native form submit (Enter on text input) routes through onSubmit handler', () => {
    const submit = vi.fn(async () => {});
    render(<ProfileBaseDataForm form={makeForm({ submit })} />);
    const formEl = document.querySelector('form');
    if (!formEl) throw new Error('expected form element');
    fireEvent.submit(formEl);
    expect(submit).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<ProfileBaseDataForm form={makeForm({ close })} />);
    await user.click(screen.getByTestId('profile-base-data-form-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows save-error banner when submit fails', () => {
    const form = makeForm({ state: openState({ error: 'quota exceeded' }) });
    render(<ProfileBaseDataForm form={form} />);
    expect(screen.getByTestId('profile-base-data-form-error')).toHaveTextContent(/quota exceeded/);
  });

  it('shows busy label and disables buttons when submitting', () => {
    const form = makeForm({ state: openState({ submitting: true }) });
    render(<ProfileBaseDataForm form={form} />);
    expect(screen.getByTestId('profile-base-data-form-submit')).toHaveTextContent(
      'Wird gespeichert...',
    );
    expect(screen.getByTestId('profile-base-data-form-submit')).toBeDisabled();
    expect(screen.getByTestId('profile-base-data-form-cancel')).toBeDisabled();
  });
});
