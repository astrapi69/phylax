import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { AddSupplementButton } from './AddSupplementButton';
import type { UseSupplementFormResult } from './useSupplementForm';

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

describe('AddSupplementButton', () => {
  it('renders the localized add label', () => {
    render(<AddSupplementButton form={makeForm()} />);
    expect(screen.getByTestId('add-supplement-btn')).toHaveTextContent('Neues Supplement');
  });

  it('clicking opens the form in create mode', async () => {
    const user = userEvent.setup();
    const openCreate = vi.fn();
    render(<AddSupplementButton form={makeForm({ openCreate })} />);
    await user.click(screen.getByTestId('add-supplement-btn'));
    expect(openCreate).toHaveBeenCalled();
  });
});
