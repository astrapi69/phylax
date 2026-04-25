import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { SupplementForm } from './SupplementForm';
import type { SupplementFormState, UseSupplementFormResult } from './useSupplementForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeSupplement } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseSupplementFormResult> = {}): UseSupplementFormResult {
  const state: SupplementFormState = overrides.state ?? {
    kind: 'open',
    mode: { kind: 'create' },
    fields: {
      name: '',
      brand: '',
      category: '',
      recommendation: '',
      rationale: '',
    },
    submitting: false,
    error: null,
  };
  return {
    state,
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    openDelete: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

function openState(extras: Partial<Extract<SupplementFormState, { kind: 'open' }>> = {}) {
  return {
    kind: 'open' as const,
    mode: extras.mode ?? { kind: 'create' as const },
    fields: extras.fields ?? {
      name: '',
      brand: '',
      category: '' as '' | 'daily' | 'regular' | 'on-demand' | 'paused',
      recommendation: '',
      rationale: '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
  };
}

describe('SupplementForm', () => {
  it('renders nothing when state is closed', () => {
    const form = makeForm({ state: { kind: 'closed' } });
    const { container } = render(<SupplementForm form={form} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mode is delete (handled by SupplementDeleteDialog)', () => {
    const form = makeForm({
      state: openState({
        mode: { kind: 'delete', supplement: makeSupplement() },
        fields: {
          name: 'Vitamin D3 2000 IE',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.queryByTestId('supplement-form')).toBeNull();
  });

  it('renders create-mode title and blank fields', () => {
    render(<SupplementForm form={makeForm()} />);
    expect(screen.getByTestId('supplement-form-title')).toHaveTextContent('Neues Supplement');
    expect(screen.getByTestId('supplement-form-name')).toHaveValue('');
    expect(screen.getByTestId('supplement-form-category')).toHaveValue('');
  });

  it('renders edit-mode title with prefilled fields', () => {
    const form = makeForm({
      state: openState({
        mode: { kind: 'edit', supplement: makeSupplement() },
        fields: {
          name: 'Magnesium',
          brand: 'tetesept',
          category: 'regular',
          recommendation: 'Abends',
          rationale: 'Krampfneigung',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.getByTestId('supplement-form-title')).toHaveTextContent('Supplement bearbeiten');
    expect(screen.getByTestId('supplement-form-name')).toHaveValue('Magnesium');
    expect(screen.getByTestId('supplement-form-brand')).toHaveValue('tetesept');
    expect(screen.getByTestId('supplement-form-category')).toHaveValue('regular');
    expect(screen.getByTestId('supplement-form-recommendation')).toHaveValue('Abends');
    expect(screen.getByTestId('supplement-form-rationale')).toHaveValue('Krampfneigung');
  });

  it('renders all four category options plus the disabled placeholder option', () => {
    render(<SupplementForm form={makeForm()} />);
    const select = screen.getByTestId('supplement-form-category');
    const options = Array.from(select.querySelectorAll('option'));
    expect(options).toHaveLength(5); // placeholder + 4 categories
    const placeholder = options[0];
    expect(placeholder).toHaveValue('');
    expect(placeholder).toBeDisabled();
    const categoryValues = options.slice(1).map((o) => o.getAttribute('value'));
    expect(categoryValues).toEqual(['daily', 'regular', 'on-demand', 'paused']);
  });

  it('disables submit when name is empty', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: '',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.getByTestId('supplement-form-submit')).toBeDisabled();
    expect(screen.getByTestId('supplement-form-name-error')).toHaveTextContent(
      'Name ist erforderlich',
    );
  });

  it('disables submit when category is empty (placeholder selected)', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: 'Magnesium',
          brand: '',
          category: '',
          recommendation: '',
          rationale: '',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.getByTestId('supplement-form-submit')).toBeDisabled();
    expect(screen.getByTestId('supplement-form-category-error')).toBeInTheDocument();
  });

  it('disables submit when name is whitespace only', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: '   ',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.getByTestId('supplement-form-submit')).toBeDisabled();
  });

  it('enables submit when both required fields are valid', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: 'Magnesium',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.getByTestId('supplement-form-submit')).not.toBeDisabled();
  });

  it('typing in each field invokes setField with the right key', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    render(<SupplementForm form={makeForm({ setField })} />);
    await user.type(screen.getByTestId('supplement-form-name'), 'V');
    await user.type(screen.getByTestId('supplement-form-brand'), 't');
    await user.type(screen.getByTestId('supplement-form-recommendation'), 'M');
    await user.type(screen.getByTestId('supplement-form-rationale'), 'B');
    expect(setField).toHaveBeenCalledWith('name', 'V');
    expect(setField).toHaveBeenCalledWith('brand', 't');
    expect(setField).toHaveBeenCalledWith('recommendation', 'M');
    expect(setField).toHaveBeenCalledWith('rationale', 'B');
  });

  it('changing category select calls setField("category", value)', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    render(<SupplementForm form={makeForm({ setField })} />);
    await user.selectOptions(screen.getByTestId('supplement-form-category'), 'regular');
    expect(setField).toHaveBeenCalledWith('category', 'regular');
  });

  it('clicking submit calls form.submit when valid', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    const form = makeForm({
      submit,
      state: openState({
        fields: {
          name: 'Magnesium',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    await user.click(screen.getByTestId('supplement-form-submit'));
    expect(submit).toHaveBeenCalled();
  });

  it('native form submit (e.g., Enter) routes through onSubmit handler', () => {
    const submit = vi.fn(async () => {});
    const form = makeForm({
      submit,
      state: openState({
        fields: {
          name: 'Magnesium',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
      }),
    });
    render(<SupplementForm form={form} />);
    const formEl = document.querySelector('form');
    if (!formEl) throw new Error('expected form element in document');
    fireEvent.submit(formEl);
    expect(submit).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<SupplementForm form={makeForm({ close })} />);
    await user.click(screen.getByTestId('supplement-form-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows save-error banner when submit fails', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: 'Magnesium',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
        error: 'quota exceeded',
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.getByTestId('supplement-form-error')).toHaveTextContent(/quota exceeded/);
  });

  it('shows busy label and disables both buttons when submitting', () => {
    const form = makeForm({
      state: openState({
        fields: {
          name: 'Magnesium',
          brand: '',
          category: 'daily',
          recommendation: '',
          rationale: '',
        },
        submitting: true,
      }),
    });
    render(<SupplementForm form={form} />);
    expect(screen.getByTestId('supplement-form-submit')).toHaveTextContent('Wird gespeichert...');
    expect(screen.getByTestId('supplement-form-submit')).toBeDisabled();
    expect(screen.getByTestId('supplement-form-cancel')).toBeDisabled();
  });
});
