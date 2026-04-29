import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import { Header } from './Header';

// Mock the lock function
vi.mock('../../crypto', () => ({
  lock: vi.fn(),
}));

describe('Header', () => {
  it('shows app name "Phylax"', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Phylax')).toBeInTheDocument();
  });

  it('lock button calls lock()', async () => {
    const { lock } = await import('../../crypto');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText('Phylax sperren'));
    expect(lock).toHaveBeenCalled();
  });

  it('app name links to /profile', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const link = screen.getByText('Phylax');
    expect(link.closest('a')).toHaveAttribute('href', '/profile');
  });

  it('hides the hamburger trigger when onOpenNavDrawer is not provided (BUG-02 desktop default)', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('header-hamburger')).not.toBeInTheDocument();
  });

  it('renders the hamburger trigger when onOpenNavDrawer is provided (BUG-02 mobile)', async () => {
    const onOpenNavDrawer = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header onOpenNavDrawer={onOpenNavDrawer} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    const trigger = screen.getByTestId('header-hamburger');
    expect(trigger).toHaveAttribute('aria-label', 'Navigation öffnen');
    await user.click(trigger);
    expect(onOpenNavDrawer).toHaveBeenCalledOnce();
  });
});
