import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { OpenPointForm } from './OpenPointForm';
import type { OpenPointFormState, UseOpenPointFormResult } from './useOpenPointForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeOpenPoint } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseOpenPointFormResult> = {}): UseOpenPointFormResult {
  const state: OpenPointFormState = overrides.state ?? {
    kind: 'open',
    mode: { kind: 'create' },
    fields: { text: '', context: '', priority: '', timeHorizon: '', details: '' },
    submitting: false,
    error: null,
    contexts: [],
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
    toggle: vi.fn(async () => {}),
    togglingId: null,
    toggleError: null,
    ...overrides,
  };
}

function openState(extras: Partial<Extract<OpenPointFormState, { kind: 'open' }>> = {}) {
  return {
    kind: 'open' as const,
    mode: extras.mode ?? { kind: 'create' as const },
    fields: extras.fields ?? {
      text: '',
      context: '',
      priority: '',
      timeHorizon: '',
      details: '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
    contexts: extras.contexts ?? [],
  };
}

describe('OpenPointForm', () => {
  it('renders nothing when state is closed', () => {
    const form = makeForm({ state: { kind: 'closed' } });
    const { container } = render(<OpenPointForm form={form} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mode is delete', () => {
    const form = makeForm({
      state: openState({ mode: { kind: 'delete', point: makeOpenPoint() } }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.queryByTestId('open-point-form')).toBeNull();
  });

  it('renders create-mode title and blank fields', () => {
    render(<OpenPointForm form={makeForm()} />);
    expect(screen.getByTestId('open-point-form-title')).toHaveTextContent('Neuer offener Punkt');
    expect(screen.getByTestId('open-point-form-text')).toHaveValue('');
    expect(screen.getByTestId('open-point-form-context')).toHaveValue('');
  });

  it('renders edit-mode title with prefilled fields', () => {
    const form = makeForm({
      state: openState({
        mode: { kind: 'edit', point: makeOpenPoint() },
        fields: {
          text: 'MRT besprechen',
          context: 'Hausarzt',
          priority: 'hoch',
          timeHorizon: '3 Monate',
          details: 'Linke Schulter',
        },
      }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.getByTestId('open-point-form-title')).toHaveTextContent(
      'Offenen Punkt bearbeiten',
    );
    expect(screen.getByTestId('open-point-form-text')).toHaveValue('MRT besprechen');
    expect(screen.getByTestId('open-point-form-context')).toHaveValue('Hausarzt');
    expect(screen.getByTestId('open-point-form-priority')).toHaveValue('hoch');
    expect(screen.getByTestId('open-point-form-time-horizon')).toHaveValue('3 Monate');
  });

  it('renders context datalist with profile-wide suggestions', () => {
    const form = makeForm({
      state: openState({ contexts: ['Dermatologe', 'Hausarzt'] }),
    });
    render(<OpenPointForm form={form} />);
    const datalist = screen.getByTestId('open-point-form-context-datalist');
    expect(datalist.querySelectorAll('option')).toHaveLength(2);
  });

  it('disables submit when text empty', () => {
    const form = makeForm({
      state: openState({
        fields: { text: '', context: 'Hausarzt', priority: '', timeHorizon: '', details: '' },
      }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.getByTestId('open-point-form-submit')).toBeDisabled();
    expect(screen.getByTestId('open-point-form-text-error')).toBeInTheDocument();
  });

  it('disables submit when context empty', () => {
    const form = makeForm({
      state: openState({
        fields: { text: 'X', context: '', priority: '', timeHorizon: '', details: '' },
      }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.getByTestId('open-point-form-submit')).toBeDisabled();
    expect(screen.getByTestId('open-point-form-context-error')).toBeInTheDocument();
  });

  it('enables submit when both required fields valid', () => {
    const form = makeForm({
      state: openState({
        fields: {
          text: 'Blutabnahme',
          context: 'Hausarzt',
          priority: '',
          timeHorizon: '',
          details: '',
        },
      }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.getByTestId('open-point-form-submit')).not.toBeDisabled();
  });

  it('typing in each field invokes setField', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    render(<OpenPointForm form={makeForm({ setField })} />);
    await user.type(screen.getByTestId('open-point-form-text'), 'T');
    await user.type(screen.getByTestId('open-point-form-context'), 'C');
    await user.type(screen.getByTestId('open-point-form-priority'), 'P');
    await user.type(screen.getByTestId('open-point-form-time-horizon'), 'H');
    expect(setField).toHaveBeenCalledWith('text', 'T');
    expect(setField).toHaveBeenCalledWith('context', 'C');
    expect(setField).toHaveBeenCalledWith('priority', 'P');
    expect(setField).toHaveBeenCalledWith('timeHorizon', 'H');
  });

  it('clicking submit calls form.submit', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    const form = makeForm({
      submit,
      state: openState({
        fields: { text: 'X', context: 'Y', priority: '', timeHorizon: '', details: '' },
      }),
    });
    render(<OpenPointForm form={form} />);
    await user.click(screen.getByTestId('open-point-form-submit'));
    expect(submit).toHaveBeenCalled();
  });

  it('native form submit routes through onSubmit handler', () => {
    const submit = vi.fn(async () => {});
    const form = makeForm({
      submit,
      state: openState({
        fields: { text: 'X', context: 'Y', priority: '', timeHorizon: '', details: '' },
      }),
    });
    render(<OpenPointForm form={form} />);
    const formEl = document.querySelector('form');
    if (!formEl) throw new Error('expected form element');
    fireEvent.submit(formEl);
    expect(submit).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<OpenPointForm form={makeForm({ close })} />);
    await user.click(screen.getByTestId('open-point-form-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows save-error banner when submit fails', () => {
    const form = makeForm({
      state: openState({
        fields: { text: 'X', context: 'Y', priority: '', timeHorizon: '', details: '' },
        error: 'quota exceeded',
      }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.getByTestId('open-point-form-error')).toHaveTextContent(/quota exceeded/);
  });

  it('shows busy label when submitting', () => {
    const form = makeForm({
      state: openState({
        fields: { text: 'X', context: 'Y', priority: '', timeHorizon: '', details: '' },
        submitting: true,
      }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.getByTestId('open-point-form-submit')).toHaveTextContent('Wird gespeichert...');
    expect(screen.getByTestId('open-point-form-submit')).toBeDisabled();
    expect(screen.getByTestId('open-point-form-cancel')).toBeDisabled();
  });

  it('expands optional disclosure when editing point with existing details', () => {
    const form = makeForm({
      state: openState({
        mode: { kind: 'edit', point: makeOpenPoint({ details: 'Some markdown' }) },
        fields: {
          text: 'X',
          context: 'Y',
          priority: '',
          timeHorizon: '',
          details: 'Some markdown',
        },
      }),
    });
    render(<OpenPointForm form={form} />);
    expect(screen.getByTestId('open-point-form-optional').hasAttribute('open')).toBe(true);
  });
});
