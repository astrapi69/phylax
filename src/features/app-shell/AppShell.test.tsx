import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/test" element={<p>Test Content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('AppShell', () => {
  it('renders header, nav, and main', () => {
    renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders children in main content area', () => {
    renderShell();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('hamburger button opens NavDrawer; X button closes it (BUG-02)', async () => {
    renderShell();
    const user = userEvent.setup();
    expect(screen.queryByTestId('nav-drawer')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('header-hamburger'));
    expect(screen.getByTestId('nav-drawer')).toBeInTheDocument();
    await user.click(screen.getByTestId('nav-drawer-close'));
    expect(screen.queryByTestId('nav-drawer')).not.toBeInTheDocument();
  });
});
