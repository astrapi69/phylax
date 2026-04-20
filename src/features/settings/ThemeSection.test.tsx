import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../theme';
import { THEME_STORAGE_KEY } from '../theme';
import { ThemeSection } from './ThemeSection';

function renderSection(initial?: 'light' | 'dark' | 'auto') {
  if (initial) window.localStorage.setItem(THEME_STORAGE_KEY, initial);
  return render(
    <ThemeProvider>
      <ThemeSection />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeSection', () => {
  it('renders three radio options', () => {
    renderSection();
    expect(screen.getByRole('radio', { name: /Hell/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Dunkel/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /System folgen/ })).toBeInTheDocument();
  });

  it('marks the current theme as checked', () => {
    renderSection('dark');
    expect(screen.getByRole('radio', { name: /Dunkel/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Hell/ })).not.toBeChecked();
  });

  it('changing selection calls setTheme and updates storage', async () => {
    const user = userEvent.setup();
    renderSection('light');
    await user.click(screen.getByRole('radio', { name: /Dunkel/ }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('each radio has an accessible label via <label>', () => {
    renderSection();
    const light = screen.getByRole('radio', { name: /Hell/ }) as HTMLInputElement;
    expect(light.id).toBe('theme-option-light');
  });

  it('shows helper text for the auto option', () => {
    renderSection();
    expect(screen.getByText(/Folgt den Einstellungen deines Geraets/)).toBeInTheDocument();
  });
});
