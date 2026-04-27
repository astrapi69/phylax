import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { OpenPointActions } from './OpenPointActions';
import type { UseOpenPointFormResult } from './useOpenPointForm';
import { makeOpenPoint } from './test-helpers';

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

describe('OpenPointActions', () => {
  it('renders edit + delete buttons with text-specific aria labels', () => {
    const point = makeOpenPoint({ text: 'Blutabnahme' });
    render(<OpenPointActions point={point} form={makeForm()} />);
    expect(screen.getByTestId(`open-point-edit-btn-${point.id}`)).toHaveAccessibleName(
      'Blutabnahme bearbeiten',
    );
    expect(screen.getByTestId(`open-point-delete-btn-${point.id}`)).toHaveAccessibleName(
      'Blutabnahme löschen',
    );
  });

  it('clicking edit invokes openEdit with the point', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn(async () => {});
    const point = makeOpenPoint();
    render(<OpenPointActions point={point} form={makeForm({ openEdit })} />);
    await user.click(screen.getByTestId(`open-point-edit-btn-${point.id}`));
    expect(openEdit).toHaveBeenCalledWith(point);
  });

  it('clicking delete invokes openDelete with the point', async () => {
    const user = userEvent.setup();
    const openDelete = vi.fn();
    const point = makeOpenPoint();
    render(<OpenPointActions point={point} form={makeForm({ openDelete })} />);
    await user.click(screen.getByTestId(`open-point-delete-btn-${point.id}`));
    expect(openDelete).toHaveBeenCalledWith(point);
  });

  it('action buttons satisfy 44x44 touch target', () => {
    const point = makeOpenPoint();
    render(<OpenPointActions point={point} form={makeForm()} />);
    const edit = screen.getByTestId(`open-point-edit-btn-${point.id}`);
    const del = screen.getByTestId(`open-point-delete-btn-${point.id}`);
    expect(edit.className).toMatch(/min-h-\[44px\]/);
    expect(edit.className).toMatch(/min-w-\[44px\]/);
    expect(del.className).toMatch(/min-h-\[44px\]/);
    expect(del.className).toMatch(/min-w-\[44px\]/);
  });
});
