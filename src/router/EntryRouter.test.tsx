import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EntryRouter } from './EntryRouter';

vi.mock('../db/meta', () => ({
  metaExists: vi.fn(),
}));

vi.mock('../crypto', () => ({
  getLockState: vi.fn(),
}));

import { metaExists } from '../db/meta';
import { getLockState } from '../crypto';

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<EntryRouter />} />
        <Route path="/welcome" element={<div data-testid="destination-welcome" />} />
        <Route path="/unlock" element={<div data-testid="destination-unlock" />} />
        <Route path="/profile" element={<div data-testid="destination-profile" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EntryRouter', () => {
  beforeEach(() => {
    vi.mocked(metaExists).mockReset();
    vi.mocked(getLockState).mockReset();
  });

  it('redirects to /welcome when no meta row exists (first-run user)', async () => {
    vi.mocked(metaExists).mockResolvedValue(false);
    vi.mocked(getLockState).mockReturnValue('locked');
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('destination-welcome')).toBeInTheDocument());
  });

  it('redirects to /unlock when meta exists and keystore is locked', async () => {
    vi.mocked(metaExists).mockResolvedValue(true);
    vi.mocked(getLockState).mockReturnValue('locked');
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('destination-unlock')).toBeInTheDocument());
  });

  it('redirects to /profile when meta exists and keystore is unlocked', async () => {
    vi.mocked(metaExists).mockResolvedValue(true);
    vi.mocked(getLockState).mockReturnValue('unlocked');
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('destination-profile')).toBeInTheDocument());
  });

  it('renders nothing during the initial meta-read tick', () => {
    // metaExists returns an unresolved promise so the component sits in
    // the null-target branch. No destination stub is reachable yet.
    vi.mocked(metaExists).mockReturnValue(new Promise(() => {}));
    vi.mocked(getLockState).mockReturnValue('locked');
    renderAt('/');
    expect(screen.queryByTestId('destination-welcome')).not.toBeInTheDocument();
    expect(screen.queryByTestId('destination-unlock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('destination-profile')).not.toBeInTheDocument();
  });

  it('skips the navigation when unmounted before auth resolves (cancelled guard)', async () => {
    // The cancelled guard must return before setTarget, so no "state
    // update on an unmounted component" warning is logged.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolveMeta!: (value: boolean) => void;
    vi.mocked(metaExists).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveMeta = resolve;
      }),
    );
    vi.mocked(getLockState).mockReturnValue('unlocked');

    const { unmount } = renderAt('/');
    unmount();
    resolveMeta(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByTestId('destination-profile')).not.toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
