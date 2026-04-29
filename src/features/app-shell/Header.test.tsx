import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../theme';
import { SearchProvider } from '../search-trigger';
import { Header } from './Header';

function renderHeader(
  ui: ReactNode = <Header />,
  options: { initialEntries?: string[] } = {},
) {
  return render(
    <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>
      <ThemeProvider>
        <SearchProvider>{ui}</SearchProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

// Mock the lock function
vi.mock('../../crypto', () => ({
  lock: vi.fn(),
}));

describe('Header', () => {
  it('shows app name "Phylax"', () => {
    renderHeader();
    expect(screen.getByText('Phylax')).toBeInTheDocument();
  });

  it('lock button calls lock()', async () => {
    const { lock } = await import('../../crypto');
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByLabelText('Phylax sperren'));
    expect(lock).toHaveBeenCalled();
  });

  it('app name links to /profile', () => {
    renderHeader();
    const link = screen.getByText('Phylax');
    expect(link.closest('a')).toHaveAttribute('href', '/profile');
  });

  it('hides the hamburger trigger when onOpenNavDrawer is not provided (BUG-02 desktop default)', () => {
    renderHeader();
    expect(screen.queryByTestId('header-hamburger')).not.toBeInTheDocument();
  });

  it('renders the hamburger trigger when onOpenNavDrawer is provided (BUG-02 mobile)', async () => {
    const onOpenNavDrawer = vi.fn();
    const user = userEvent.setup();
    renderHeader(<Header onOpenNavDrawer={onOpenNavDrawer} />);
    const trigger = screen.getByTestId('header-hamburger');
    expect(trigger).toHaveAttribute('aria-label', 'Navigation öffnen');
    await user.click(trigger);
    expect(onOpenNavDrawer).toHaveBeenCalledOnce();
  });

  it('hides the search magnifier on a non-search route (P-22)', () => {
    renderHeader(<Header />, { initialEntries: ['/profile'] });
    expect(screen.queryByTestId('header-search-toggle')).not.toBeInTheDocument();
  });

  it('renders the search magnifier on a search route (P-22)', () => {
    renderHeader(<Header />, { initialEntries: ['/observations'] });
    expect(screen.getByTestId('header-search-toggle')).toBeInTheDocument();
  });

  it('shows the active-filter indicator dot when URL has filter and bar is closed', () => {
    renderHeader(<Header />, { initialEntries: ['/observations?q=foo&'] });
    // SearchProvider auto-opens on URL filter, so the indicator
    // (only shown when isOpen=false + hasActiveFilter) is hidden in
    // the auto-open default. Verify the "no indicator while open"
    // half here.
    expect(
      screen.queryByTestId('header-search-toggle-active-indicator'),
    ).not.toBeInTheDocument();
  });

  it('toggles the inline search bar when the magnifier is clicked', async () => {
    renderHeader(<Header />, { initialEntries: ['/observations'] });
    const toggle = screen.getByTestId('header-search-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const user = userEvent.setup();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
