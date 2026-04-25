import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { AddObservationButton } from './AddObservationButton';
import type { UseObservationFormResult } from './useObservationForm';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(overrides: Partial<UseObservationFormResult> = {}): UseObservationFormResult {
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

describe('AddObservationButton', () => {
  it('renders the localized label', () => {
    render(<AddObservationButton form={makeForm()} />);
    expect(screen.getByTestId('add-observation-btn')).toHaveTextContent('Neue Beobachtung');
  });

  it('click calls form.openCreate', async () => {
    const user = userEvent.setup();
    const openCreate = vi.fn(async () => {});
    render(<AddObservationButton form={makeForm({ openCreate })} />);
    await user.click(screen.getByTestId('add-observation-btn'));
    expect(openCreate).toHaveBeenCalled();
  });
});
