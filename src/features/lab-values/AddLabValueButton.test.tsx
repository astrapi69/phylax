import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { AddLabValueButton } from './AddLabValueButton';
import type { UseLabValueFormResult } from './useLabValueForm';

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

describe('AddLabValueButton', () => {
  it('renders the localized add label', () => {
    render(<AddLabValueButton reportId="lr1" form={makeForm()} />);
    expect(screen.getByTestId('add-lab-value-btn-lr1')).toHaveTextContent('Wert hinzufügen');
  });

  it('clicking opens the form in create mode bound to the report id', async () => {
    const user = userEvent.setup();
    const openCreate = vi.fn(async () => {});
    render(<AddLabValueButton reportId="lr-target" form={makeForm({ openCreate })} />);
    await user.click(screen.getByTestId('add-lab-value-btn-lr-target'));
    expect(openCreate).toHaveBeenCalledWith('lr-target');
  });

  it('button satisfies 44px touch height (WCAG 2.5.5)', () => {
    render(<AddLabValueButton reportId="lr1" form={makeForm()} />);
    expect(screen.getByTestId('add-lab-value-btn-lr1').className).toMatch(/min-h-\[44px\]/);
  });
});
