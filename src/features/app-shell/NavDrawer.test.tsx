import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NavDrawer } from './NavDrawer';

function renderDrawer(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <button data-testid="trigger" type="button">
                trigger
              </button>
              <NavDrawer open={open} onClose={onClose} />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NavDrawer (BUG-02 mobile hamburger)', () => {
  it('renders nothing when open is false', () => {
    renderDrawer(false);
    expect(screen.queryByTestId('nav-drawer')).not.toBeInTheDocument();
  });

  it('renders dialog with all NAV_ITEMS when open', () => {
    renderDrawer(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Spot-check a few entries
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Beobachtungen')).toBeInTheDocument();
    expect(screen.getByText('Einstellungen')).toBeInTheDocument();
    // All NAV_ITEMS should be NavLink anchors
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(nav.querySelectorAll('a')).toHaveLength(10);
  });

  it('backdrop click invokes onClose', async () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('nav-drawer-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('top-left burger button invokes onClose (BUG-06)', async () => {
    // Mirrors the Header's hamburger position so users tapping
    // top-left to dismiss the drawer get the expected behaviour.
    // The previous right-side X button was removed in BUG-06
    // follow-up; backdrop + Escape remain as alternative dismiss
    // paths.
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('nav-drawer-burger-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('right-side X button is no longer rendered (BUG-06 follow-up)', () => {
    renderDrawer(true);
    expect(screen.queryByTestId('nav-drawer-close')).toBeNull();
  });

  it('Escape key invokes onClose', async () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking a nav item invokes onClose', async () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    const user = userEvent.setup();
    await user.click(screen.getByText('Beobachtungen'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('active route is highlighted', () => {
    renderDrawer(true);
    const link = screen.getByText('Profil').closest('a');
    expect(link?.className).toContain('text-blue-700');
  });
});
