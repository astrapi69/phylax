import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { ObservationForm } from './ObservationForm';
import type { ObservationFormState, UseObservationFormResult } from './useObservationForm';
import { __resetScrollLockForTest } from '../../ui';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseObservationFormResult> = {}): UseObservationFormResult {
  const state: ObservationFormState = overrides.state ?? {
    kind: 'open',
    mode: { kind: 'create' },
    fields: {
      theme: '',
      fact: '',
      pattern: '',
      selfRegulation: '',
      status: '',
      medicalFinding: '',
      relevanceNotes: '',
    },
    submitting: false,
    error: null,
    themes: ['Blutdruck', 'Schulter'],
  };
  return {
    state,
    openCreate: vi.fn(async () => {}),
    openEdit: vi.fn(async () => {}),
    openDelete: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

describe('ObservationForm', () => {
  it('renders nothing when state is closed', () => {
    const form = makeForm({ state: { kind: 'closed' } });
    const { container } = render(<ObservationForm form={form} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mode is delete (handled by ObservationDeleteDialog)', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: {
          kind: 'delete',
          observation: {
            id: 'x',
            profileId: 'p',
            createdAt: 0,
            updatedAt: 0,
            theme: 'Schulter',
            fact: '',
            pattern: '',
            selfRegulation: '',
            status: '',
            source: 'user',
            extraSections: {},
          },
        },
        fields: {
          theme: 'Schulter',
          fact: '',
          pattern: '',
          selfRegulation: '',
          status: '',
          medicalFinding: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
        themes: [],
      },
    });
    expect(screen.queryByTestId('observation-form')).toBeNull();
    render(<ObservationForm form={form} />);
    expect(screen.queryByTestId('observation-form')).toBeNull();
  });

  it('renders create-mode title + blank theme + datalist with suggestions', () => {
    const form = makeForm();
    render(<ObservationForm form={form} />);
    expect(screen.getByTestId('observation-form-title')).toHaveTextContent('Neue Beobachtung');
    expect(screen.getByTestId('observation-form-theme')).toHaveValue('');
    const datalist = screen.getByTestId('observation-form-theme-datalist');
    expect(datalist.querySelectorAll('option')).toHaveLength(2);
  });

  it('renders edit-mode title with prefilled fields', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: {
          kind: 'edit',
          observation: {
            id: 'x',
            profileId: 'p',
            createdAt: 0,
            updatedAt: 0,
            theme: 'Knie',
            fact: 'Schmerz',
            pattern: '',
            selfRegulation: '',
            status: 'akut',
            source: 'user',
            extraSections: {},
          },
        },
        fields: {
          theme: 'Knie',
          fact: 'Schmerz',
          pattern: '',
          selfRegulation: '',
          status: 'akut',
          medicalFinding: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
        themes: [],
      },
    });
    render(<ObservationForm form={form} />);
    expect(screen.getByTestId('observation-form-title')).toHaveTextContent(
      'Beobachtung bearbeiten',
    );
    expect(screen.getByTestId('observation-form-theme')).toHaveValue('Knie');
    expect(screen.getByTestId('observation-form-fact')).toHaveValue('Schmerz');
    expect(screen.getByTestId('observation-form-status')).toHaveValue('akut');
  });

  it('expands optional disclosure by default when editing observation with optional data', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: {
          kind: 'edit',
          observation: {
            id: 'x',
            profileId: 'p',
            createdAt: 0,
            updatedAt: 0,
            theme: 'Knie',
            fact: '',
            pattern: '',
            selfRegulation: '',
            status: '',
            source: 'user',
            medicalFinding: 'Befund von Dr. X',
            extraSections: {},
          },
        },
        fields: {
          theme: 'Knie',
          fact: '',
          pattern: '',
          selfRegulation: '',
          status: '',
          medicalFinding: 'Befund von Dr. X',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
        themes: [],
      },
    });
    render(<ObservationForm form={form} />);
    const disclosure = screen.getByTestId('observation-form-optional');
    expect(disclosure.hasAttribute('open')).toBe(true);
  });

  it('collapses optional disclosure by default in create mode', () => {
    const form = makeForm();
    render(<ObservationForm form={form} />);
    const disclosure = screen.getByTestId('observation-form-optional');
    expect(disclosure.hasAttribute('open')).toBe(false);
  });

  it('disables submit when theme is empty', () => {
    const form = makeForm();
    render(<ObservationForm form={form} />);
    expect(screen.getByTestId('observation-form-submit')).toBeDisabled();
  });

  it('shows theme-required error message when theme is empty', () => {
    const form = makeForm();
    render(<ObservationForm form={form} />);
    expect(screen.getByTestId('observation-form-theme-error')).toHaveTextContent(
      'Thema darf nicht leer sein',
    );
  });

  it('enables submit when theme has content (after trim)', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          theme: 'Schulter',
          fact: '',
          pattern: '',
          selfRegulation: '',
          status: '',
          medicalFinding: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
        themes: [],
      },
    });
    render(<ObservationForm form={form} />);
    expect(screen.getByTestId('observation-form-submit')).not.toBeDisabled();
  });

  it('typing in a field calls setField', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    const form = makeForm({ setField });
    render(<ObservationForm form={form} />);
    await user.type(screen.getByTestId('observation-form-theme'), 'X');
    expect(setField).toHaveBeenCalledWith('theme', 'X');
  });

  it('clicking submit calls form.submit', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          theme: 'Schulter',
          fact: '',
          pattern: '',
          selfRegulation: '',
          status: '',
          medicalFinding: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
        themes: [],
      },
      submit,
    });
    render(<ObservationForm form={form} />);
    await user.click(screen.getByTestId('observation-form-submit'));
    expect(submit).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const form = makeForm({ close });
    render(<ObservationForm form={form} />);
    await user.click(screen.getByTestId('observation-form-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows save-error banner when submit fails', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          theme: 'Schulter',
          fact: '',
          pattern: '',
          selfRegulation: '',
          status: '',
          medicalFinding: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: 'quota exceeded',
        themes: [],
      },
    });
    render(<ObservationForm form={form} />);
    expect(screen.getByTestId('observation-form-error')).toHaveTextContent(/quota exceeded/);
  });

  it('shows busy label when submitting', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          theme: 'Schulter',
          fact: '',
          pattern: '',
          selfRegulation: '',
          status: '',
          medicalFinding: '',
          relevanceNotes: '',
        },
        submitting: true,
        error: null,
        themes: [],
      },
    });
    render(<ObservationForm form={form} />);
    expect(screen.getByTestId('observation-form-submit')).toHaveTextContent('Wird gespeichert...');
    expect(screen.getByTestId('observation-form-submit')).toBeDisabled();
    expect(screen.getByTestId('observation-form-cancel')).toBeDisabled();
  });
});
