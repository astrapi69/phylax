import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { LabValueForm } from './LabValueForm';
import type { LabValueFormState, UseLabValueFormResult } from './useLabValueForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeLabValue } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseLabValueFormResult> = {}): UseLabValueFormResult {
  const state: LabValueFormState = overrides.state ?? {
    kind: 'open',
    mode: { kind: 'create', reportId: 'lr1' },
    fields: {
      category: '',
      parameter: '',
      result: '',
      unit: '',
      referenceRange: '',
      assessment: '',
    },
    submitting: false,
    error: null,
    parameters: [],
    categories: [],
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

function openState(extras: Partial<Extract<LabValueFormState, { kind: 'open' }>> = {}) {
  return {
    kind: 'open' as const,
    mode: extras.mode ?? { kind: 'create' as const, reportId: 'lr1' },
    fields: extras.fields ?? {
      category: '',
      parameter: '',
      result: '',
      unit: '',
      referenceRange: '',
      assessment: '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
    parameters: extras.parameters ?? [],
    categories: extras.categories ?? [],
  };
}

describe('LabValueForm', () => {
  it('renders nothing when state is closed', () => {
    const form = makeForm({ state: { kind: 'closed' } });
    const { container } = render(<LabValueForm form={form} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mode is delete (handled by LabValueDeleteDialog)', () => {
    const form = makeForm({
      state: openState({
        mode: { kind: 'delete', value: makeLabValue() },
        fields: {
          category: 'Blutbild',
          parameter: 'Leukozyten',
          result: '6,04',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.queryByTestId('lab-value-form')).toBeNull();
  });

  it('renders create-mode title and blank fields', () => {
    render(<LabValueForm form={makeForm()} />);
    expect(screen.getByTestId('lab-value-form-title')).toHaveTextContent('Neuer Wert');
    expect(screen.getByTestId('lab-value-form-category')).toHaveValue('');
    expect(screen.getByTestId('lab-value-form-parameter')).toHaveValue('');
    expect(screen.getByTestId('lab-value-form-result')).toHaveValue('');
  });

  it('renders edit-mode title with prefilled fields', () => {
    const value = makeLabValue({
      category: 'Stoffwechsel',
      parameter: 'Glukose',
      result: '95',
      unit: 'mg/dl',
      referenceRange: '70-99',
      assessment: 'normal',
    });
    const form = makeForm({
      state: openState({
        mode: { kind: 'edit', value },
        fields: {
          category: 'Stoffwechsel',
          parameter: 'Glukose',
          result: '95',
          unit: 'mg/dl',
          referenceRange: '70-99',
          assessment: 'normal',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.getByTestId('lab-value-form-title')).toHaveTextContent('Wert bearbeiten');
    expect(screen.getByTestId('lab-value-form-category')).toHaveValue('Stoffwechsel');
    expect(screen.getByTestId('lab-value-form-parameter')).toHaveValue('Glukose');
    expect(screen.getByTestId('lab-value-form-result')).toHaveValue('95');
    expect(screen.getByTestId('lab-value-form-unit')).toHaveValue('mg/dl');
    expect(screen.getByTestId('lab-value-form-reference-range')).toHaveValue('70-99');
    expect(screen.getByTestId('lab-value-form-assessment')).toHaveValue('normal');
  });

  it('renders parameter datalist with profile-wide suggestions', () => {
    const form = makeForm({
      state: openState({ parameters: ['Hämoglobin', 'Kreatinin', 'TSH'] }),
    });
    render(<LabValueForm form={form} />);
    const datalist = screen.getByTestId('lab-value-form-parameter-datalist');
    const options = datalist.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute('value', 'Hämoglobin');
  });

  it('renders category datalist scoped to active report', () => {
    const form = makeForm({
      state: openState({ categories: ['Blutbild', 'Nierenwerte'] }),
    });
    render(<LabValueForm form={form} />);
    const datalist = screen.getByTestId('lab-value-form-category-datalist');
    const options = datalist.querySelectorAll('option');
    expect(options).toHaveLength(2);
  });

  it('renders fixed assessment suggestions', () => {
    render(<LabValueForm form={makeForm()} />);
    const datalist = screen.getByTestId('lab-value-form-assessment-datalist');
    const options = datalist.querySelectorAll('option');
    const values = Array.from(options).map((o) => o.getAttribute('value'));
    expect(values).toEqual(['normal', 'erhöht', 'erniedrigt', 'kritisch']);
  });

  it('disables submit when category is empty', () => {
    const form = makeForm({
      state: openState({
        fields: {
          category: '',
          parameter: 'Hb',
          result: '14.2',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.getByTestId('lab-value-form-submit')).toBeDisabled();
    expect(screen.getByTestId('lab-value-form-category-error')).toHaveTextContent(
      'Kategorie ist erforderlich',
    );
  });

  it('disables submit when parameter is empty', () => {
    const form = makeForm({
      state: openState({
        fields: {
          category: 'Blutbild',
          parameter: '',
          result: '14.2',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.getByTestId('lab-value-form-submit')).toBeDisabled();
    expect(screen.getByTestId('lab-value-form-parameter-error')).toBeInTheDocument();
  });

  it('disables submit when result is empty', () => {
    const form = makeForm({
      state: openState({
        fields: {
          category: 'Blutbild',
          parameter: 'Hb',
          result: '',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.getByTestId('lab-value-form-submit')).toBeDisabled();
    expect(screen.getByTestId('lab-value-form-result-error')).toBeInTheDocument();
  });

  it('enables submit when all required fields are filled', () => {
    const form = makeForm({
      state: openState({
        fields: {
          category: 'Blutbild',
          parameter: 'Hb',
          result: '14.2',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.getByTestId('lab-value-form-submit')).not.toBeDisabled();
  });

  it('typing in each field invokes setField with the right key', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    render(<LabValueForm form={makeForm({ setField })} />);
    await user.type(screen.getByTestId('lab-value-form-category'), 'B');
    await user.type(screen.getByTestId('lab-value-form-parameter'), 'H');
    await user.type(screen.getByTestId('lab-value-form-result'), '1');
    await user.type(screen.getByTestId('lab-value-form-unit'), 'g');
    await user.type(screen.getByTestId('lab-value-form-reference-range'), 'r');
    await user.type(screen.getByTestId('lab-value-form-assessment'), 'n');
    expect(setField).toHaveBeenCalledWith('category', 'B');
    expect(setField).toHaveBeenCalledWith('parameter', 'H');
    expect(setField).toHaveBeenCalledWith('result', '1');
    expect(setField).toHaveBeenCalledWith('unit', 'g');
    expect(setField).toHaveBeenCalledWith('referenceRange', 'r');
    expect(setField).toHaveBeenCalledWith('assessment', 'n');
  });

  it('native form submit (e.g., Enter) routes through onSubmit handler', () => {
    const submit = vi.fn(async () => {});
    const form = makeForm({
      submit,
      state: openState({
        fields: {
          category: 'Blutbild',
          parameter: 'Hb',
          result: '14.2',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    const formEl = document.querySelector('form');
    if (!formEl) throw new Error('expected form element in document');
    fireEvent.submit(formEl);
    expect(submit).toHaveBeenCalled();
  });

  it('clicking submit calls form.submit when valid', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    const form = makeForm({
      submit,
      state: openState({
        fields: {
          category: 'Blutbild',
          parameter: 'Hb',
          result: '14.2',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
      }),
    });
    render(<LabValueForm form={form} />);
    await user.click(screen.getByTestId('lab-value-form-submit'));
    expect(submit).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<LabValueForm form={makeForm({ close })} />);
    await user.click(screen.getByTestId('lab-value-form-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows save-error banner when submit fails', () => {
    const form = makeForm({
      state: openState({
        fields: {
          category: 'Blutbild',
          parameter: 'Hb',
          result: '14.2',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
        error: 'quota exceeded',
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.getByTestId('lab-value-form-error')).toHaveTextContent(/quota exceeded/);
  });

  it('shows busy label and disables both buttons when submitting', () => {
    const form = makeForm({
      state: openState({
        fields: {
          category: 'Blutbild',
          parameter: 'Hb',
          result: '14.2',
          unit: '',
          referenceRange: '',
          assessment: '',
        },
        submitting: true,
      }),
    });
    render(<LabValueForm form={form} />);
    expect(screen.getByTestId('lab-value-form-submit')).toHaveTextContent('Wird gespeichert...');
    expect(screen.getByTestId('lab-value-form-submit')).toBeDisabled();
    expect(screen.getByTestId('lab-value-form-cancel')).toBeDisabled();
  });
});
