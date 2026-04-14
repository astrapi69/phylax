import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen', () => {
  it('renders the Einstellungen heading and the ThemeSection', () => {
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Darstellung' })).toBeInTheDocument();
    // All three theme options are present.
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('exposes the current theme as the checked radio', () => {
    window.localStorage.setItem('phylax-theme', 'dark');
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByRole('radio', { name: /Dunkel/ })).toBeChecked();
  });
});
