import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SetupFlowGuard } from './SetupFlowGuard';

vi.mock('../db/meta', () => ({
  metaExists: vi.fn(),
}));

import { metaExists } from '../db/meta';

const SETUP_ROUTES = ['/welcome', '/privacy', '/setup'] as const;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SetupFlowGuard />}>
          <Route path="/welcome" element={<div data-testid="child-welcome" />} />
          <Route path="/privacy" element={<div data-testid="child-privacy" />} />
          <Route path="/setup" element={<div data-testid="child-setup" />} />
        </Route>
        <Route path="/unlock" element={<div data-testid="destination-unlock" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SetupFlowGuard', () => {
  beforeEach(() => {
    vi.mocked(metaExists).mockReset();
  });

  it.each(SETUP_ROUTES)('renders children at %s when no vault exists', async (path) => {
    vi.mocked(metaExists).mockResolvedValue(false);
    renderAt(path);
    const childTestId = `child-${path.slice(1)}`;
    await waitFor(() => expect(screen.getByTestId(childTestId)).toBeInTheDocument());
    expect(screen.queryByTestId('destination-unlock')).not.toBeInTheDocument();
  });

  it.each(SETUP_ROUTES)('redirects from %s to /unlock when vault exists', async (path) => {
    vi.mocked(metaExists).mockResolvedValue(true);
    renderAt(path);
    await waitFor(() => expect(screen.getByTestId('destination-unlock')).toBeInTheDocument());
    expect(screen.queryByTestId(`child-${path.slice(1)}`)).not.toBeInTheDocument();
  });

  it('renders nothing during the initial meta-read tick', () => {
    // Unresolved promise: guard stays in 'checking'. No child reachable.
    vi.mocked(metaExists).mockReturnValue(new Promise(() => {}));
    renderAt('/welcome');
    expect(screen.queryByTestId('child-welcome')).not.toBeInTheDocument();
    expect(screen.queryByTestId('destination-unlock')).not.toBeInTheDocument();
  });

  it('fails open: renders children when metaExists rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(metaExists).mockRejectedValue(new Error('indexeddb dead'));
    renderAt('/welcome');
    await waitFor(() => expect(screen.getByTestId('child-welcome')).toBeInTheDocument());
    expect(screen.queryByTestId('destination-unlock')).not.toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(
      'SetupFlowGuard: resolveAuthState failed, allowing setup flow',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});
