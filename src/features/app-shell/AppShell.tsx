import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { NavBar } from './NavBar';

/**
 * Application shell layout.
 * Wraps all authenticated content with header, navigation, and main content area.
 * Mobile-first: bottom nav on small screens, side nav on md+.
 */
export function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <NavBar />

      {/* Main content area: offset for header (h-14) and bottom nav (h-16 on mobile) */}
      <main className="pb-16 pt-14 md:pb-0 md:pl-48">
        <div className="mx-auto max-w-4xl p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
