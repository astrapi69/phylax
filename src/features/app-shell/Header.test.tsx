import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';

// Mock the lock function
vi.mock('../../crypto', () => ({
  lock: vi.fn(),
}));

describe('Header', () => {
  it('shows app name "Phylax"', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByText('Phylax')).toBeInTheDocument();
  });

  it('lock button calls lock()', async () => {
    const { lock } = await import('../../crypto');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText('Phylax sperren'));
    expect(lock).toHaveBeenCalled();
  });

  it('app name links to /profile', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    const link = screen.getByText('Phylax');
    expect(link.closest('a')).toHaveAttribute('href', '/profile');
  });
});
