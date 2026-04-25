import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { SupplementDeleteDialog } from './SupplementDeleteDialog';
import type { SupplementFormState, UseSupplementFormResult } from './useSupplementForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeSupplement } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseSupplementFormResult> = {}): UseSupplementFormResult {
  const state: SupplementFormState = overrides.state ?? { kind: 'closed' };
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

function deleteState(
  supplement = makeSupplement({ name: 'Magnesium', brand: 'tetesept' }),
  extras: { submitting?: boolean; error?: string | null } = {},
): SupplementFormState {
  return {
    kind: 'open',
    mode: { kind: 'delete', supplement },
    fields: {
      name: supplement.name,
      brand: supplement.brand ?? '',
      category: supplement.category,
      recommendation: supplement.recommendation ?? '',
      rationale: supplement.rationale ?? '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
  };
}

describe('SupplementDeleteDialog', () => {
  it('renders nothing when state is closed', () => {
    render(<SupplementDeleteDialog form={makeForm({ state: { kind: 'closed' } })} />);
    expect(screen.queryByTestId('supplement-delete-dialog')).toBeNull();
  });

  it('renders name + brand in body when brand is present', () => {
    const form = makeForm({
      state: deleteState(makeSupplement({ name: 'Magnesium', brand: 'tetesept' })),
    });
    render(<SupplementDeleteDialog form={form} />);
    const message = screen.getByTestId('supplement-delete-message');
    expect(message).toHaveTextContent('Magnesium');
    expect(message).toHaveTextContent('tetesept');
  });

  it('renders name only when brand is absent', () => {
    const form = makeForm({
      state: deleteState(makeSupplement({ name: 'Vitamin D3', brand: undefined })),
    });
    render(<SupplementDeleteDialog form={form} />);
    const message = screen.getByTestId('supplement-delete-message');
    expect(message).toHaveTextContent('Vitamin D3');
    expect(message).not.toHaveTextContent(/[(]/);
  });

  it('renders name only when brand is whitespace', () => {
    const form = makeForm({
      state: deleteState(makeSupplement({ name: 'Vitamin D3', brand: '   ' })),
    });
    render(<SupplementDeleteDialog form={form} />);
    const message = screen.getByTestId('supplement-delete-message');
    expect(message).not.toHaveTextContent(/[(]/);
  });

  it('clicking confirm calls form.confirmDelete', async () => {
    const user = userEvent.setup();
    const confirmDelete = vi.fn(async () => {});
    const form = makeForm({ state: deleteState(), confirmDelete });
    render(<SupplementDeleteDialog form={form} />);
    await user.click(screen.getByTestId('supplement-delete-confirm'));
    expect(confirmDelete).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const form = makeForm({ state: deleteState(), close });
    render(<SupplementDeleteDialog form={form} />);
    await user.click(screen.getByTestId('supplement-delete-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows delete error inline when set', () => {
    const form = makeForm({
      state: deleteState(undefined, { error: 'crypto failure' }),
    });
    render(<SupplementDeleteDialog form={form} />);
    expect(screen.getByTestId('supplement-delete-error')).toBeInTheDocument();
  });

  it('shows busy label and disables buttons when submitting', () => {
    const form = makeForm({
      state: deleteState(undefined, { submitting: true }),
    });
    render(<SupplementDeleteDialog form={form} />);
    expect(screen.getByTestId('supplement-delete-confirm')).toBeDisabled();
    expect(screen.getByTestId('supplement-delete-cancel')).toBeDisabled();
    expect(screen.getByTestId('supplement-delete-confirm')).toHaveTextContent(/Wird gelöscht/);
  });
});
