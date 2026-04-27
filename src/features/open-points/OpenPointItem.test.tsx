import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenPointItem } from './OpenPointItem';
import type { UseOpenPointFormResult } from './useOpenPointForm';
import { makeOpenPoint } from './test-helpers';

function makeFormStub(overrides: Partial<UseOpenPointFormResult> = {}): UseOpenPointFormResult {
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

describe('OpenPointItem', () => {
  it('renders the point text', () => {
    render(<OpenPointItem point={makeOpenPoint({ text: 'MRT-Ergebnis besprechen' })} />);
    expect(screen.getByText('MRT-Ergebnis besprechen')).toBeInTheDocument();
  });

  it('renders priority as a badge when present', () => {
    render(<OpenPointItem point={makeOpenPoint({ priority: 'hoch' })} />);
    expect(screen.getByText('hoch')).toBeInTheDocument();
  });

  it('renders time horizon as a badge when present', () => {
    render(<OpenPointItem point={makeOpenPoint({ timeHorizon: 'Innerhalb 3 Monate' })} />);
    expect(screen.getByText('Innerhalb 3 Monate')).toBeInTheDocument();
  });

  it('resolved item shows checkbox checked + Erledigt badge + strikethrough (no form prop = read-only)', () => {
    const { container } = render(
      <OpenPointItem point={makeOpenPoint({ resolved: true, text: 'erledigter Punkt' })} />,
    );
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText('Erledigt')).toBeInTheDocument();
    expect(screen.getByText('erledigter Punkt').className).toMatch(/line-through/);
    // Muted container tint (bg-gray-50) instead of bg-white
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/bg-gray-50/);
  });

  it('renders details via MarkdownContent when present', () => {
    render(
      <OpenPointItem point={makeOpenPoint({ details: 'Zusatz mit **fett** hervorgehoben.' })} />,
    );
    expect(screen.getByText('fett').tagName.toLowerCase()).toBe('strong');
  });

  it('omits action cluster when no form prop supplied (read-only mode)', () => {
    render(<OpenPointItem point={makeOpenPoint()} />);
    expect(screen.queryByTestId('open-point-actions')).toBeNull();
  });

  it('renders action cluster when form prop is supplied', () => {
    render(<OpenPointItem point={makeOpenPoint()} form={makeFormStub()} />);
    expect(screen.getByTestId('open-point-actions')).toBeInTheDocument();
  });

  it('checkbox is interactive when form prop supplied; click fires form.toggle', async () => {
    const user = userEvent.setup();
    const toggle = vi.fn(async () => {});
    const point = makeOpenPoint({ id: 'op-toggle' });
    render(<OpenPointItem point={point} form={makeFormStub({ toggle })} />);
    const checkbox = screen.getByTestId('open-point-toggle-op-toggle') as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
    await user.click(checkbox);
    expect(toggle).toHaveBeenCalledWith(point);
  });

  it('checkbox disabled while toggle in flight (togglingId === point.id)', () => {
    const point = makeOpenPoint({ id: 'op-flight' });
    render(
      <OpenPointItem point={point} form={makeFormStub({ togglingId: 'op-flight' })} />,
    );
    expect(screen.getByTestId('open-point-toggle-op-flight')).toBeDisabled();
  });

  it('clicking edit action opens form in edit mode', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn(async () => {});
    const point = makeOpenPoint({ id: 'op-edit' });
    render(<OpenPointItem point={point} form={makeFormStub({ openEdit })} />);
    await user.click(screen.getByTestId('open-point-edit-btn-op-edit'));
    expect(openEdit).toHaveBeenCalledWith(point);
  });

  it('clicking delete action opens form in delete mode', async () => {
    const user = userEvent.setup();
    const openDelete = vi.fn();
    const point = makeOpenPoint({ id: 'op-del' });
    render(<OpenPointItem point={point} form={makeFormStub({ openDelete })} />);
    await user.click(screen.getByTestId('open-point-delete-btn-op-del'));
    expect(openDelete).toHaveBeenCalledWith(point);
  });
});
