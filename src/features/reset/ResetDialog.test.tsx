import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import i18n from '../../i18n/config';
import { ResetDialog } from './ResetDialog';

const ORIGINAL_LOCATION = window.location;
let originalDeleteDatabase: typeof indexedDB.deleteDatabase;

function installDeleteDbAutoSuccess(): void {
  indexedDB.deleteDatabase = ((_name: string) => {
    const request: {
      onsuccess: ((ev: Event) => void) | null;
      onerror: ((ev: Event) => void) | null;
      onblocked: ((ev: Event) => void) | null;
    } = {
      onsuccess: null,
      onerror: null,
      onblocked: null,
    };
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({} as Event);
    }, 0);
    return request as unknown as IDBOpenDBRequest;
  }) as unknown as typeof indexedDB.deleteDatabase;
}

function stubLocation(): { replace: ReturnType<typeof vi.fn> } {
  const replace = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, replace },
  });
  return { replace };
}

beforeEach(() => {
  originalDeleteDatabase = indexedDB.deleteDatabase;
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

afterEach(() => {
  indexedDB.deleteDatabase = originalDeleteDatabase;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: ORIGINAL_LOCATION,
  });
});

describe('ResetDialog', () => {
  it('renders title, warning, and challenge prompt with the literal RESET string', () => {
    render(<ResetDialog onCancel={vi.fn()} />);
    expect(screen.getByTestId('reset-dialog-title')).toHaveTextContent(/Alle Daten löschen/);
    expect(screen.getByTestId('reset-dialog-warning')).toHaveTextContent(/dauerhaft gelöscht/);
    expect(screen.getByLabelText(/RESET/)).toBeInTheDocument();
  });

  it('focuses the Cancel button on mount (a11y for destructive defaults)', async () => {
    render(<ResetDialog onCancel={vi.fn()} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('reset-cancel-btn'));
    });
  });

  it('disables Confirm until the input matches RESET exactly', () => {
    render(<ResetDialog onCancel={vi.fn()} />);
    const input = screen.getByTestId('reset-challenge-input') as HTMLInputElement;
    const confirm = screen.getByTestId('reset-confirm-btn');

    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: 'reset' } }); // lowercase
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: ' RESET' } }); // leading space
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: 'RESET ' } }); // trailing space
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: 'RESET' } }); // exact
    expect(confirm).not.toBeDisabled();
  });

  it('Cancel button calls onCancel without resetting', () => {
    const onCancel = vi.fn();
    render(<ResetDialog onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('reset-cancel-btn'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape key calls onCancel', () => {
    const onCancel = vi.fn();
    render(<ResetDialog onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByTestId('reset-dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not auto-confirm on Enter — must explicitly activate Confirm', async () => {
    installDeleteDbAutoSuccess();
    const { replace } = stubLocation();

    render(<ResetDialog onCancel={vi.fn()} />);
    const input = screen.getByTestId('reset-challenge-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'RESET' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Brief wait — Enter must NOT have triggered the wipe.
    await new Promise((r) => setTimeout(r, 30));
    expect(replace).not.toHaveBeenCalled();
  });

  it('Confirm click runs the wipe and ultimately calls location.replace', async () => {
    installDeleteDbAutoSuccess();
    const { replace } = stubLocation();

    render(<ResetDialog onCancel={vi.fn()} />);
    const input = screen.getByTestId('reset-challenge-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'RESET' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-confirm-btn'));
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('dialog has role=alertdialog and aria-modal=true', () => {
    render(<ResetDialog onCancel={vi.fn()} />);
    const dialog = screen.getByTestId('reset-dialog');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'reset-dialog-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'reset-dialog-warning');
  });
});
