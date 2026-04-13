import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock } from '../crypto';
import { setupCompletedOnboarding } from '../db/test-helpers';
import { RequireProfile } from './RequireProfile';

const TEST_PASSWORD = 'test-password-12';

beforeEach(async () => {
  lock();
});

function renderWithRouter(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/profile/create" element={<p>Create Profile</p>} />
        <Route
          path="/profile"
          element={
            <RequireProfile>
              <p>Profile Content</p>
            </RequireProfile>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireProfile', () => {
  it('redirects to /profile/create when no profile exists', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD);
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    renderWithRouter(['/profile']);

    await waitFor(() => {
      expect(screen.getByText('Create Profile')).toBeInTheDocument();
    });

    lock();
  });

  it('renders children when profile exists', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD, { createDefaultProfile: true });
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    renderWithRouter(['/profile']);

    await waitFor(() => {
      expect(screen.getByText('Profile Content')).toBeInTheDocument();
    });

    lock();
  });

  it('shows loading state initially', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD);
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    renderWithRouter(['/profile']);

    // Loading state shown before async check completes
    expect(screen.getByText('Laden...')).toBeInTheDocument();

    lock();
  });
});
