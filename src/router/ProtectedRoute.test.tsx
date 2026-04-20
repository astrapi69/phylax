import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock } from '../crypto';
import { resetDatabase, setupCompletedOnboarding } from '../db/test-helpers';
import { ProtectedRoute } from './ProtectedRoute';

const TEST_PASSWORD = 'test-password-12';

function renderWithRouter(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/welcome" element={<p>Welcome</p>} />
        <Route path="/unlock" element={<p>Unlock</p>} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <p>Protected Content</p>
            </ProtectedRoute>
          }
        />
        <Route
          path="/observations"
          element={
            <ProtectedRoute>
              <p>Observations</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(async () => {
    lock();
    await resetDatabase();
  });

  it('redirects to /welcome when no meta exists', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderWithRouter(['/profile']);

    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('redirects to /unlock with returnTo when meta exists but locked', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await setupCompletedOnboarding(TEST_PASSWORD);

    renderWithRouter(['/observations']);

    await waitFor(() => {
      expect(screen.getByText('Unlock')).toBeInTheDocument();
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('renders children when unlocked', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD);
    // Unlock the store
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    renderWithRouter(['/profile']);

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    lock();
  });

  it('shows loading state initially', () => {
    renderWithRouter(['/profile']);
    expect(screen.getByText('Laden...')).toBeInTheDocument();
  });
});
