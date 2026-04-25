import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { LabValueDeleteDialog } from './LabValueDeleteDialog';
import type { LabValueFormState, UseLabValueFormResult } from './useLabValueForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeLabValue } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseLabValueFormResult> = {}): UseLabValueFormResult {
  const state: LabValueFormState = overrides.state ?? { kind: 'closed' };
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

function deleteState(
  value = makeLabValue({ parameter: 'Kreatinin', result: '1.2', unit: 'mg/dl' }),
  extras: { submitting?: boolean; error?: string | null } = {},
): LabValueFormState {
  return {
    kind: 'open',
    mode: { kind: 'delete', value },
    fields: {
      category: value.category,
      parameter: value.parameter,
      result: value.result,
      unit: value.unit ?? '',
      referenceRange: value.referenceRange ?? '',
      assessment: value.assessment ?? '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
    parameters: [],
    categories: [],
  };
}

describe('LabValueDeleteDialog', () => {
  it('renders nothing when state is closed', () => {
    render(<LabValueDeleteDialog form={makeForm({ state: { kind: 'closed' } })} />);
    expect(screen.queryByTestId('lab-value-delete-dialog')).toBeNull();
  });

  it('renders parameter + result + unit in body', () => {
    const form = makeForm({
      state: deleteState(makeLabValue({ parameter: 'Kreatinin', result: '1.2', unit: 'mg/dl' })),
    });
    render(<LabValueDeleteDialog form={form} />);
    const message = screen.getByTestId('lab-value-delete-message');
    expect(message).toHaveTextContent('Kreatinin');
    expect(message).toHaveTextContent('1.2');
    expect(message).toHaveTextContent('mg/dl');
  });

  it('renders parameter + result without unit when unit absent', () => {
    const form = makeForm({
      state: deleteState(makeLabValue({ parameter: 'HIV', result: 'negativ', unit: undefined })),
    });
    render(<LabValueDeleteDialog form={form} />);
    const message = screen.getByTestId('lab-value-delete-message');
    expect(message).toHaveTextContent('HIV');
    expect(message).toHaveTextContent('negativ');
  });

  it('clicking confirm calls form.confirmDelete', async () => {
    const user = userEvent.setup();
    const confirmDelete = vi.fn(async () => {});
    const form = makeForm({ state: deleteState(), confirmDelete });
    render(<LabValueDeleteDialog form={form} />);
    await user.click(screen.getByTestId('lab-value-delete-confirm'));
    expect(confirmDelete).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const form = makeForm({ state: deleteState(), close });
    render(<LabValueDeleteDialog form={form} />);
    await user.click(screen.getByTestId('lab-value-delete-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows delete error inline when set', () => {
    const form = makeForm({
      state: deleteState(undefined, { error: 'crypto failure' }),
    });
    render(<LabValueDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-value-delete-error')).toBeInTheDocument();
  });

  it('shows busy label and disables buttons when submitting', () => {
    const form = makeForm({
      state: deleteState(undefined, { submitting: true }),
    });
    render(<LabValueDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-value-delete-confirm')).toBeDisabled();
    expect(screen.getByTestId('lab-value-delete-cancel')).toBeDisabled();
    expect(screen.getByTestId('lab-value-delete-confirm')).toHaveTextContent(/Wird gelöscht/);
  });
});
