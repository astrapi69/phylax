import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { THEME_STORAGE_KEY } from './themeStorage';

function renderToggle(initial?: 'light' | 'dark' | 'auto') {
  if (initial) window.localStorage.setItem(THEME_STORAGE_KEY, initial);
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  it('renders the sun icon when theme is light', () => {
    renderToggle('light');
    expect(screen.getByTestId('theme-icon-light')).toBeInTheDocument();
  });

  it('renders the moon icon when theme is dark', () => {
    renderToggle('dark');
    expect(screen.getByTestId('theme-icon-dark')).toBeInTheDocument();
  });

  it('renders the auto icon when theme is auto (default)', () => {
    renderToggle();
    expect(screen.getByTestId('theme-icon-auto')).toBeInTheDocument();
  });

  it('aria-label describes current and next state', () => {
    renderToggle('light');
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/Hell.*Klicken für Dunkel/));
  });

  it('cycles light -> dark -> auto -> light on clicks', async () => {
    const user = userEvent.setup();
    renderToggle('light');
    await user.click(screen.getByRole('button'));
    expect(screen.getByTestId('theme-icon-dark')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByTestId('theme-icon-auto')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByTestId('theme-icon-light')).toBeInTheDocument();
  });

  it('is keyboard-operable (Enter activates)', async () => {
    const user = userEvent.setup();
    renderToggle('light');
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('theme-icon-dark')).toBeInTheDocument();
  });
});
