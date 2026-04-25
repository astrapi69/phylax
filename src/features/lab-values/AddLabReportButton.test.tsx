import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { AddLabReportButton } from './AddLabReportButton';
import type { UseLabReportFormResult } from './useLabReportForm';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(overrides: Partial<UseLabReportFormResult> = {}): UseLabReportFormResult {
  return {
    state: { kind: 'closed' },
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    openDelete: vi.fn(async () => {}),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

describe('AddLabReportButton', () => {
  it('renders the localized add label', () => {
    render(<AddLabReportButton form={makeForm()} />);
    expect(screen.getByTestId('add-lab-report-btn')).toHaveTextContent('Neuer Befund');
  });

  it('clicking the button opens the form in create mode', async () => {
    const user = userEvent.setup();
    const openCreate = vi.fn();
    render(<AddLabReportButton form={makeForm({ openCreate })} />);
    await user.click(screen.getByTestId('add-lab-report-btn'));
    expect(openCreate).toHaveBeenCalled();
  });
});
