import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';
import { THEME_STORAGE_KEY } from './themeStorage';

function Probe({ onValue }: { onValue: (v: ReturnType<typeof useTheme>) => void }) {
  const v = useTheme();
  onValue(v);
  return null;
}

type MediaListener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<MediaListener>();
  const mql: MediaQueryList = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener: (_: string, cb: EventListenerOrEventListenerObject) =>
      listeners.add(cb as MediaListener),
    removeEventListener: (_: string, cb: EventListenerOrEventListenerObject) =>
      listeners.delete(cb as MediaListener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
  const spy = vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
  return {
    mql,
    listeners,
    restore: () => spy.mockRestore(),
    fireChange: (matches: boolean) => {
      (mql as { matches: boolean }).matches = matches;
      for (const l of listeners) l({ matches } as MediaQueryListEvent);
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('applies the dark class when stored theme is dark', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <div>x</div>
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes the dark class when stored theme is light', () => {
    document.documentElement.classList.add('dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <div>x</div>
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists setTheme calls to localStorage', () => {
    let api: ReturnType<typeof useTheme> | null = null;
    render(
      <ThemeProvider>
        <Probe onValue={(v) => (api = v)} />
      </ThemeProvider>,
    );
    if (!api) throw new Error('Probe did not receive a value');
    const setTheme = api.setTheme;
    act(() => {
      setTheme('dark');
    });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('listens to prefers-color-scheme changes in auto mode', () => {
    const m = mockMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'auto');
    let api: ReturnType<typeof useTheme> | null = null;
    render(
      <ThemeProvider>
        <Probe onValue={(v) => (api = v)} />
      </ThemeProvider>,
    );
    if (!api) throw new Error('Probe did not receive a value');
    expect((api as ReturnType<typeof useTheme>).resolvedTheme).toBe('light');
    act(() => {
      m.fireChange(true);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes the media query listener on unmount', () => {
    const m = mockMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'auto');
    const { unmount } = render(
      <ThemeProvider>
        <div>x</div>
      </ThemeProvider>,
    );
    expect(m.listeners.size).toBe(1);
    unmount();
    expect(m.listeners.size).toBe(0);
  });
});
