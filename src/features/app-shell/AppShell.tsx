import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SearchProvider } from '../search-trigger';
import { Header } from './Header';
import { NavBar } from './NavBar';
import { NavDrawer } from './NavDrawer';

/**
 * Application shell layout.
 *
 * Wraps all authenticated content with the header, the desktop side
 * navigation, the mobile-only nav drawer, and the main content area.
 *
 * BUG-02: mobile bottom-nav replaced with hamburger drawer
 * (NavDrawer). The drawer-open state lives here because two
 * children read/write it: the Header hamburger button opens it,
 * the drawer itself closes it (Escape, backdrop click, X button,
 * any nav-item click).
 *
 * P-22 pivot: SearchProvider wraps the shell so the global header
 * magnifier and the inline view-body search bars share a single
 * `isOpen` source. Provider sits inside the Router (uses
 * `useLocation` / `useSearchParams`) but outside Header + Outlet
 * so both consume the same instance.
 *
 * Layout offsets:
 *   - `pt-14` to clear the fixed h-14 Header on every viewport.
 *   - `md:pl-48` to clear the desktop NavBar (w-48 fixed on the
 *     left). Mobile no longer reserves bottom padding; the bottom-
 *     nav is gone.
 */
export function AppShell() {
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const openNavDrawer = useCallback(() => setNavDrawerOpen(true), []);
  const closeNavDrawer = useCallback(() => setNavDrawerOpen(false), []);

  return (
    <SearchProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header onOpenNavDrawer={openNavDrawer} />
        <NavBar />
        <NavDrawer open={navDrawerOpen} onClose={closeNavDrawer} />

        <main className="pt-14 md:pl-48">
          <div className="mx-auto max-w-4xl p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </SearchProvider>
  );
}
