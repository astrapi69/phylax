import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveProfileProvider, useActiveProfile, ACTIVE_PROFILE_STORAGE_KEY } from './index';

function Probe() {
  const { activeProfileId, setActiveProfileId } = useActiveProfile();
  return (
    <div>
      <span data-testid="active">{activeProfileId ?? '<null>'}</span>
      <button onClick={() => setActiveProfileId('p-alpha')}>set-alpha</button>
      <button onClick={() => setActiveProfileId('p-beta')}>set-beta</button>
      <button onClick={() => setActiveProfileId(null)}>clear</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
});

afterEach(() => {
  localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
});

describe('ActiveProfileProvider', () => {
  it('initializes to null when storage is empty', () => {
    render(
      <ActiveProfileProvider>
        <Probe />
      </ActiveProfileProvider>,
    );
    expect(screen.getByTestId('active').textContent).toBe('<null>');
  });

  it('hydrates from storage on mount', () => {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, 'p-stored');
    render(
      <ActiveProfileProvider>
        <Probe />
      </ActiveProfileProvider>,
    );
    expect(screen.getByTestId('active').textContent).toBe('p-stored');
  });

  it('persists changes to storage', async () => {
    const user = userEvent.setup();
    render(
      <ActiveProfileProvider>
        <Probe />
      </ActiveProfileProvider>,
    );
    await user.click(screen.getByText('set-alpha'));
    expect(screen.getByTestId('active').textContent).toBe('p-alpha');
    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBe('p-alpha');
  });

  it('switches between profiles', async () => {
    const user = userEvent.setup();
    render(
      <ActiveProfileProvider>
        <Probe />
      </ActiveProfileProvider>,
    );
    await user.click(screen.getByText('set-alpha'));
    expect(screen.getByTestId('active').textContent).toBe('p-alpha');
    await user.click(screen.getByText('set-beta'));
    expect(screen.getByTestId('active').textContent).toBe('p-beta');
    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBe('p-beta');
  });

  it('clears storage when set to null', async () => {
    const user = userEvent.setup();
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, 'p-stored');
    render(
      <ActiveProfileProvider>
        <Probe />
      </ActiveProfileProvider>,
    );
    expect(screen.getByTestId('active').textContent).toBe('p-stored');
    await user.click(screen.getByText('clear'));
    expect(screen.getByTestId('active').textContent).toBe('<null>');
    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('picks up cross-tab changes via the storage event', () => {
    render(
      <ActiveProfileProvider>
        <Probe />
      </ActiveProfileProvider>,
    );
    expect(screen.getByTestId('active').textContent).toBe('<null>');

    // Simulate another tab writing the storage value.
    act(() => {
      const event = new StorageEvent('storage', {
        key: ACTIVE_PROFILE_STORAGE_KEY,
        newValue: 'p-other-tab',
        oldValue: null,
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });
    expect(screen.getByTestId('active').textContent).toBe('p-other-tab');
  });

  it('ignores storage events for unrelated keys', () => {
    render(
      <ActiveProfileProvider>
        <Probe />
      </ActiveProfileProvider>,
    );
    act(() => {
      const event = new StorageEvent('storage', {
        key: 'some-other-key',
        newValue: 'whatever',
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });
    expect(screen.getByTestId('active').textContent).toBe('<null>');
  });

  it('falls back to localStorage read + noop setter when no provider is present', () => {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, 'p-direct');
    render(<Probe />);
    expect(screen.getByTestId('active').textContent).toBe('p-direct');
    // setActiveProfileId is a noop outside the provider; clicking
    // does not surface an error and does not change the rendered
    // value.
    expect(() => screen.getByText('set-alpha').click()).not.toThrow();
  });
});
