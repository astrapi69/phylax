import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { OpenPointDeleteDialog } from './OpenPointDeleteDialog';
import type { OpenPointFormState, UseOpenPointFormResult } from './useOpenPointForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeOpenPoint } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseOpenPointFormResult> = {}): UseOpenPointFormResult {
  const state: OpenPointFormState = overrides.state ?? { kind: 'closed' };
  return {
    state,
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

function deleteState(
  point = makeOpenPoint({ text: 'Wiederholungs-Blutabnahme', context: 'Hausarzt' }),
  extras: { submitting?: boolean; error?: string | null } = {},
): OpenPointFormState {
  return {
    kind: 'open',
    mode: { kind: 'delete', point },
    fields: {
      text: point.text,
      context: point.context,
      priority: point.priority ?? '',
      timeHorizon: point.timeHorizon ?? '',
      details: point.details ?? '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
    contexts: [],
  };
}

describe('OpenPointDeleteDialog', () => {
  it('renders nothing when state is closed', () => {
    render(<OpenPointDeleteDialog form={makeForm({ state: { kind: 'closed' } })} />);
    expect(screen.queryByTestId('open-point-delete-dialog')).toBeNull();
  });

  it('renders text + context when context present', () => {
    const form = makeForm({
      state: deleteState(
        makeOpenPoint({ text: 'Blutabnahme im Mai', context: 'Hausarzt' }),
      ),
    });
    render(<OpenPointDeleteDialog form={form} />);
    const message = screen.getByTestId('open-point-delete-message');
    expect(message).toHaveTextContent('Blutabnahme im Mai');
    expect(message).toHaveTextContent('Hausarzt');
  });

  it('truncates long text with ellipsis', () => {
    const longText = 'A'.repeat(100);
    const form = makeForm({
      state: deleteState(makeOpenPoint({ text: longText })),
    });
    render(<OpenPointDeleteDialog form={form} />);
    const message = screen.getByTestId('open-point-delete-message');
    expect(message.textContent).toMatch(/…/);
  });

  it('clicking confirm calls form.confirmDelete', async () => {
    const user = userEvent.setup();
    const confirmDelete = vi.fn(async () => {});
    render(<OpenPointDeleteDialog form={makeForm({ state: deleteState(), confirmDelete })} />);
    await user.click(screen.getByTestId('open-point-delete-confirm'));
    expect(confirmDelete).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<OpenPointDeleteDialog form={makeForm({ state: deleteState(), close })} />);
    await user.click(screen.getByTestId('open-point-delete-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows delete error inline', () => {
    const form = makeForm({ state: deleteState(undefined, { error: 'crypto failure' }) });
    render(<OpenPointDeleteDialog form={form} />);
    expect(screen.getByTestId('open-point-delete-error')).toBeInTheDocument();
  });

  it('shows busy label and disables buttons when submitting', () => {
    const form = makeForm({ state: deleteState(undefined, { submitting: true }) });
    render(<OpenPointDeleteDialog form={form} />);
    expect(screen.getByTestId('open-point-delete-confirm')).toBeDisabled();
    expect(screen.getByTestId('open-point-delete-cancel')).toBeDisabled();
    expect(screen.getByTestId('open-point-delete-confirm')).toHaveTextContent(/Wird gelöscht/);
  });
});
