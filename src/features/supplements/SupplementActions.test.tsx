import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { SupplementActions } from './SupplementActions';
import type { UseSupplementFormResult } from './useSupplementForm';
import { makeSupplement } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(overrides: Partial<UseSupplementFormResult> = {}): UseSupplementFormResult {
  return {
    state: { kind: 'closed' },
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

describe('SupplementActions', () => {
  it('renders edit and delete buttons with name-specific aria labels', () => {
    const supplement = makeSupplement({ name: 'Magnesium' });
    render(<SupplementActions supplement={supplement} form={makeForm()} />);
    expect(screen.getByTestId(`supplement-edit-btn-${supplement.id}`)).toHaveAccessibleName(
      'Magnesium bearbeiten',
    );
    expect(screen.getByTestId(`supplement-delete-btn-${supplement.id}`)).toHaveAccessibleName(
      'Magnesium löschen',
    );
  });

  it('clicking edit opens form in edit mode for the given supplement', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn();
    const supplement = makeSupplement();
    render(<SupplementActions supplement={supplement} form={makeForm({ openEdit })} />);
    await user.click(screen.getByTestId(`supplement-edit-btn-${supplement.id}`));
    expect(openEdit).toHaveBeenCalledWith(supplement);
  });

  it('clicking delete opens form in delete mode for the given supplement', async () => {
    const user = userEvent.setup();
    const openDelete = vi.fn();
    const supplement = makeSupplement();
    render(<SupplementActions supplement={supplement} form={makeForm({ openDelete })} />);
    await user.click(screen.getByTestId(`supplement-delete-btn-${supplement.id}`));
    expect(openDelete).toHaveBeenCalledWith(supplement);
  });

  it('action buttons satisfy 44x44 touch target (WCAG 2.5.5)', () => {
    const supplement = makeSupplement();
    render(<SupplementActions supplement={supplement} form={makeForm()} />);
    const edit = screen.getByTestId(`supplement-edit-btn-${supplement.id}`);
    const del = screen.getByTestId(`supplement-delete-btn-${supplement.id}`);
    expect(edit.className).toMatch(/min-h-\[44px\]/);
    expect(edit.className).toMatch(/min-w-\[44px\]/);
    expect(del.className).toMatch(/min-h-\[44px\]/);
    expect(del.className).toMatch(/min-w-\[44px\]/);
  });
});
