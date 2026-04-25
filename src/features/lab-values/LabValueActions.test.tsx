import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { LabValueActions } from './LabValueActions';
import type { UseLabValueFormResult } from './useLabValueForm';
import { makeLabValue } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(overrides: Partial<UseLabValueFormResult> = {}): UseLabValueFormResult {
  return {
    state: { kind: 'closed' },
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

describe('LabValueActions', () => {
  it('renders edit and delete buttons with parameter-specific labels', () => {
    const value = makeLabValue({ parameter: 'Kreatinin' });
    render(<LabValueActions value={value} form={makeForm()} />);
    expect(screen.getByTestId(`lab-value-edit-btn-${value.id}`)).toHaveAccessibleName(
      'Kreatinin bearbeiten',
    );
    expect(screen.getByTestId(`lab-value-delete-btn-${value.id}`)).toHaveAccessibleName(
      'Kreatinin löschen',
    );
  });

  it('clicking edit opens the form in edit mode for the given value', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn(async () => {});
    const value = makeLabValue();
    render(<LabValueActions value={value} form={makeForm({ openEdit })} />);
    await user.click(screen.getByTestId(`lab-value-edit-btn-${value.id}`));
    expect(openEdit).toHaveBeenCalledWith(value);
  });

  it('clicking delete opens the form in delete mode for the given value', async () => {
    const user = userEvent.setup();
    const openDelete = vi.fn();
    const value = makeLabValue();
    render(<LabValueActions value={value} form={makeForm({ openDelete })} />);
    await user.click(screen.getByTestId(`lab-value-delete-btn-${value.id}`));
    expect(openDelete).toHaveBeenCalledWith(value);
  });

  it('action buttons satisfy 44x44 touch target (WCAG 2.5.5)', () => {
    const value = makeLabValue();
    render(<LabValueActions value={value} form={makeForm()} />);
    const edit = screen.getByTestId(`lab-value-edit-btn-${value.id}`);
    const del = screen.getByTestId(`lab-value-delete-btn-${value.id}`);
    expect(edit.className).toMatch(/min-h-\[44px\]/);
    expect(edit.className).toMatch(/min-w-\[44px\]/);
    expect(del.className).toMatch(/min-h-\[44px\]/);
    expect(del.className).toMatch(/min-w-\[44px\]/);
  });
});
