import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Silence the React 18 + jsdom error-stack noise that React logs
  // automatically when an ErrorBoundary catches a render error. The
  // boundary itself also calls console.error for dev visibility; both
  // are expected here.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>healthy child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy child')).toBeInTheDocument();
  });

  it('renders the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary onReload={vi.fn()} onGoHome={vi.fn()}>
        <Boom message="kaboom-fixture" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Etwas ist schiefgelaufen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Neu laden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zur Startseite/i })).toBeInTheDocument();
  });

  it('reload button invokes the injected handler', async () => {
    const onReload = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorBoundary onReload={onReload} onGoHome={vi.fn()}>
        <Boom message="kaboom" />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: /Neu laden/i }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('home button invokes the injected handler', async () => {
    const onGoHome = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorBoundary onReload={vi.fn()} onGoHome={onGoHome}>
        <Boom message="kaboom" />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: /Zur Startseite/i }));
    expect(onGoHome).toHaveBeenCalledOnce();
  });

  it('details element renders the error message + stack', () => {
    render(
      <ErrorBoundary onReload={vi.fn()} onGoHome={vi.fn()}>
        <Boom message="distinctive-error-token" />
      </ErrorBoundary>,
    );
    const detail = screen.getByTestId('error-boundary-detail');
    expect(detail.textContent).toContain('distinctive-error-token');
    // Stack is included in the detail block (jsdom + V8 produce one).
    expect(detail.textContent?.length ?? 0).toBeGreaterThan('distinctive-error-token'.length);
  });

  it('details element is collapsed by default and uses native disclosure', () => {
    render(
      <ErrorBoundary onReload={vi.fn()} onGoHome={vi.fn()}>
        <Boom message="kaboom" />
      </ErrorBoundary>,
    );
    const detail = screen.getByTestId('error-boundary-detail');
    const details = detail.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
  });

  it('copy button writes the detail block to the clipboard (P-09a)', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    // jsdom does not ship navigator.clipboard; assign a shim that the
    // component's `navigator.clipboard?.writeText` check will pick up.
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText },
    });
    const { container } = render(
      <ErrorBoundary onReload={vi.fn()} onGoHome={vi.fn()}>
        <Boom message="copy-test-token" />
      </ErrorBoundary>,
    );
    const details = container.querySelector('details');
    if (!details) throw new Error('details element missing');
    details.open = true;
    // fireEvent (lower level than userEvent) bypasses jsdom's inertness
    // checks for the still-collapsed-from-userEvent's-pov details panel.
    fireEvent.click(screen.getByTestId('error-boundary-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const arg = writeText.mock.calls[0]?.[0] as string;
    expect(arg).toContain('copy-test-token');
  });

  it('logs error + errorInfo to console.error for dev visibility', () => {
    render(
      <ErrorBoundary onReload={vi.fn()} onGoHome={vi.fn()}>
        <Boom message="kaboom-log" />
      </ErrorBoundary>,
    );
    // Boundary logs at least once with its prefixed string. React may
    // also log; assert ours is present without being strict about
    // call count.
    const calls = consoleErrorSpy.mock.calls.flat().map((c: unknown) => String(c));
    expect(calls.some((c: string) => c.includes('[ErrorBoundary]'))).toBe(true);
  });
});
