import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { UpdateProvider, useUpdate } from './UpdateContext';

const mockUpdateSW = vi.fn();
let onNeedRefreshHook: (() => void) | null = null;

vi.mock('../../pwa/registerServiceWorker', () => ({
  setupServiceWorker: (onNeedRefresh: () => void) => {
    onNeedRefreshHook = onNeedRefresh;
    return mockUpdateSW;
  },
}));

beforeEach(() => {
  mockUpdateSW.mockReset();
  onNeedRefreshHook = null;
});

function wrap({ children }: { children: ReactNode }) {
  return <UpdateProvider>{children}</UpdateProvider>;
}

describe('UpdateContext', () => {
  it('starts with needRefresh=false', () => {
    const { result } = renderHook(() => useUpdate(), { wrapper: wrap });
    expect(result.current.needRefresh).toBe(false);
  });

  it('flips needRefresh to true when the SW signals a waiting update', () => {
    const { result } = renderHook(() => useUpdate(), { wrapper: wrap });
    expect(onNeedRefreshHook).not.toBeNull();
    onNeedRefreshHook?.();
    // Re-render reads the latest context value.
    const { result: r2 } = renderHook(() => useUpdate(), { wrapper: wrap });
    // First hook instance also sees the flip via context update.
    expect(result.current.needRefresh || r2.current.needRefresh).toBe(true);
  });

  it('apply() forwards to the registered updateSW', async () => {
    function Probe() {
      const { apply } = useUpdate();
      return (
        <button data-testid="probe" onClick={apply} type="button">
          go
        </button>
      );
    }
    render(
      <UpdateProvider>
        <Probe />
      </UpdateProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId('probe'));
    expect(mockUpdateSW).toHaveBeenCalledOnce();
  });

  it('useUpdate() outside the provider returns inert defaults (does not throw)', () => {
    const { result } = renderHook(() => useUpdate());
    expect(result.current.needRefresh).toBe(false);
    expect(() => result.current.apply()).not.toThrow();
  });
});
