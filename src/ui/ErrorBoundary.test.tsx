import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
