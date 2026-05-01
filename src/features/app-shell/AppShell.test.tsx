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

  it('hamburger button opens NavDrawer; in-drawer burger closes it (BUG-02 + BUG-06)', async () => {
    // BUG-06 follow-up: drawer's right-side X was removed; close
    // affordance is the burger at the top-left of the drawer
    // (mirrors the Header's open trigger position).
    renderShell();
    const user = userEvent.setup();
    expect(screen.queryByTestId('nav-drawer')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('header-hamburger'));
    expect(screen.getByTestId('nav-drawer')).toBeInTheDocument();
    await user.click(screen.getByTestId('nav-drawer-burger-close'));
    expect(screen.queryByTestId('nav-drawer')).not.toBeInTheDocument();
  });
});
