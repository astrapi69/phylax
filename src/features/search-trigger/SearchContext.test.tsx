import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { SearchProvider, useSearch } from './SearchContext';

function Probe() {
  const v = useSearch();
  return (
    <div>
      <span data-testid="probe-isOpen">{String(v.isOpen)}</span>
      <span data-testid="probe-hasSearch">{String(v.hasSearch)}</span>
      <span data-testid="probe-hasActiveFilter">{String(v.hasActiveFilter)}</span>
      <button data-testid="probe-open" type="button" onClick={v.open}>
        open
      </button>
      <button data-testid="probe-close" type="button" onClick={v.close}>
        close
      </button>
      <button data-testid="probe-toggle" type="button" onClick={v.toggle}>
        toggle
      </button>
    </div>
  );
}

function mount(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchProvider>
        <Probe />
      </SearchProvider>
    </MemoryRouter>,
  );
}

describe('SearchContext', () => {
  it('hasSearch=true on a known search route', () => {
    mount(['/observations']);
    expect(screen.getByTestId('probe-hasSearch').textContent).toBe('true');
  });

  it('hasSearch=false on a non-search route', () => {
    mount(['/profile']);
    expect(screen.getByTestId('probe-hasSearch').textContent).toBe('false');
  });

  it('hasActiveFilter=true when ?q= is present', () => {
    mount(['/observations?q=test']);
    expect(screen.getByTestId('probe-hasActiveFilter').textContent).toBe('true');
  });

  it('hasActiveFilter=true when ?from= is present', () => {
    mount(['/observations?from=2024-01-01']);
    expect(screen.getByTestId('probe-hasActiveFilter').textContent).toBe('true');
  });

  it('hasActiveFilter=true when ?to= is present', () => {
    mount(['/observations?to=2024-12-31']);
    expect(screen.getByTestId('probe-hasActiveFilter').textContent).toBe('true');
  });

  it('hasActiveFilter=false when no filter param is present', () => {
    mount(['/observations']);
    expect(screen.getByTestId('probe-hasActiveFilter').textContent).toBe('false');
  });

  it('isOpen defaults to true on a search route with active filter', () => {
    mount(['/observations?q=test']);
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('true');
  });

  it('isOpen defaults to false on a search route without active filter', () => {
    mount(['/observations']);
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
  });

  it('isOpen defaults to false on a non-search route even with q param', () => {
    mount(['/profile?q=test']);
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
  });

  it('open() flips isOpen to true', async () => {
    mount(['/observations']);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('probe-open'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('true');
  });

  it('close() flips isOpen to false', async () => {
    mount(['/observations?q=test']);
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('true');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('probe-close'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
  });

  it('toggle() flips isOpen', async () => {
    mount(['/observations']);
    const user = userEvent.setup();
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
    await user.click(screen.getByTestId('probe-toggle'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('true');
    await user.click(screen.getByTestId('probe-toggle'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
  });

  it('useSearch outside the provider returns inert defaults', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
    expect(screen.getByTestId('probe-hasSearch').textContent).toBe('false');
    expect(screen.getByTestId('probe-hasActiveFilter').textContent).toBe('false');
  });

  it('defaultOpen test escape hatch overrides the URL-derived default', () => {
    render(
      <MemoryRouter initialEntries={['/observations']}>
        <SearchProvider defaultOpen={true}>
          <Probe />
        </SearchProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('true');
  });

  it('route change resets isOpen based on the new route + active filter', async () => {
    function Navigator() {
      const navigate = useNavigate();
      return (
        <>
          <button data-testid="goto-profile" type="button" onClick={() => navigate('/profile')}>
            profile
          </button>
          <button
            data-testid="goto-observations-q"
            type="button"
            onClick={() => navigate('/observations?q=foo')}
          >
            observations-with-q
          </button>
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={['/observations?q=initial']}>
        <SearchProvider>
          <Probe />
          <Navigator />
        </SearchProvider>
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('true');

    // Navigate to a non-search route - isOpen should reset to false
    // (route change effect: nextHasSearch=false -> setIsOpen(false)).
    await user.click(screen.getByTestId('goto-profile'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
    expect(screen.getByTestId('probe-hasSearch').textContent).toBe('false');

    // Navigate to a search route with an active filter - isOpen should
    // re-derive to true (route change effect with nextHasSearch=true
    // and nextHasActiveFilter=true).
    await user.click(screen.getByTestId('goto-observations-q'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('true');
    expect(screen.getByTestId('probe-hasSearch').textContent).toBe('true');
    expect(screen.getByTestId('probe-hasActiveFilter').textContent).toBe('true');
  });

  it('inert defaults: open / close / toggle are callable no-ops', async () => {
    render(<Probe />);
    const user = userEvent.setup();
    // The fallback functions return undefined and do not flip isOpen.
    await user.click(screen.getByTestId('probe-open'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
    await user.click(screen.getByTestId('probe-close'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
    await user.click(screen.getByTestId('probe-toggle'));
    expect(screen.getByTestId('probe-isOpen').textContent).toBe('false');
  });
});
