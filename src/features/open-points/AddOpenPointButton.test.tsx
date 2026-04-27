import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { AddOpenPointButton } from './AddOpenPointButton';
import type { UseOpenPointFormResult } from './useOpenPointForm';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(overrides: Partial<UseOpenPointFormResult> = {}): UseOpenPointFormResult {
  return {
    state: { kind: 'closed' },
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

describe('AddOpenPointButton', () => {
  it('renders the localized add label', () => {
    render(<AddOpenPointButton form={makeForm()} />);
    expect(screen.getByTestId('add-open-point-btn')).toHaveTextContent('Neuer Punkt');
  });

  it('clicking opens the form in create mode', async () => {
    const user = userEvent.setup();
    const openCreate = vi.fn(async () => {});
    render(<AddOpenPointButton form={makeForm({ openCreate })} />);
    await user.click(screen.getByTestId('add-open-point-btn'));
    expect(openCreate).toHaveBeenCalled();
  });
});
