import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Routes that expose a search filter.
 *
 * Used by both the global header (to decide whether to show the
 * magnifier trigger) and by `useSearch().hasSearch` consumers in
 * the views themselves.
 *
 * Hardcoded list per Q-A of the P-22 architecture pivot. The
 * alternative — per-view registration via a `useRegisterSearch()`
 * hook — adds coordination overhead that is not warranted while
 * the list stays at four entries. If the surface grows beyond ~6
 * routes, refactor to registration.
 */
export const SEARCH_ROUTES: readonly string[] = [
  '/observations',
  '/lab-values',
  '/supplements',
  '/open-points',
] as const;

/** URL search-param keys that signal an active filter. */
const FILTER_PARAM_KEYS: readonly string[] = ['q', 'from', 'to'] as const;

interface SearchContextValue {
  /** True when the inline view-body search bar is rendered. */
  isOpen: boolean;
  /** Force open. */
  open: () => void;
  /** Force close. Does NOT clear filter URL params on its own. */
  close: () => void;
  /** Convenience: flip `isOpen`. Used by the header magnifier. */
  toggle: () => void;
  /** Whether the current route is in `SEARCH_ROUTES`. */
  hasSearch: boolean;
  /**
   * Whether any of `q` / `from` / `to` is set on the current URL.
   * Drives the "filter set, UI hidden" indicator dot on the header
   * magnifier when `isOpen` is false.
   */
  hasActiveFilter: boolean;
}

const SearchContext = createContext<SearchContextValue | null>(null);

interface SearchProviderProps {
  children: ReactNode;
  /**
   * Test escape hatch. Forces the initial `isOpen` value, bypassing
   * the route-aware default. Production code must NOT pass this.
   */
  defaultOpen?: boolean;
}

/**
 * Provides search-trigger state to the app shell.
 *
 * P-22 architecture pivot: the magnifier trigger lives in the global
 * header (next to the theme toggle) instead of inside each view's
 * sticky bar. The header reads `hasSearch` to decide whether to show
 * the trigger and `hasActiveFilter` to decide whether to render the
 * indicator dot. The view consumes `isOpen` to decide whether to
 * render its inline search bar.
 *
 * Default `isOpen` on every route change: `hasSearch && hasActiveFilter`.
 * That mirrors the previous in-view behaviour where a shared link
 * (`?q=foo`) auto-expanded the bar. Manual opens/closes via
 * `toggle()` / `open()` / `close()` override the default until the
 * next route change.
 */
export function SearchProvider({ children, defaultOpen }: SearchProviderProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const hasSearch = SEARCH_ROUTES.includes(location.pathname);
  const hasActiveFilter = useMemo(
    () => FILTER_PARAM_KEYS.some((k) => searchParams.has(k)),
    [searchParams],
  );

  // Initial state: tests may force-open via `defaultOpen`. Production
  // computes from the URL+route on first render.
  const [isOpen, setIsOpen] = useState<boolean>(
    defaultOpen !== undefined ? defaultOpen : hasSearch && hasActiveFilter,
  );

  // Reset on route change. The user's manual open/close state from
  // the previous route does not carry over because the previous
  // view's filter context may not apply.
  const lastPathname = useRef(location.pathname);
  useEffect(() => {
    if (lastPathname.current === location.pathname) return;
    lastPathname.current = location.pathname;
    const nextHasSearch = SEARCH_ROUTES.includes(location.pathname);
    const nextHasActiveFilter = FILTER_PARAM_KEYS.some((k) => searchParams.has(k));
    setIsOpen(nextHasSearch && nextHasActiveFilter);
  }, [location.pathname, searchParams]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const value = useMemo<SearchContextValue>(
    () => ({ isOpen, open, close, toggle, hasSearch, hasActiveFilter }),
    [isOpen, open, close, toggle, hasSearch, hasActiveFilter],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

/**
 * Read the current search-trigger state.
 *
 * Returns inert defaults outside the provider so isolated unit
 * tests for views can mount without provider boilerplate. The
 * fallback reports `hasSearch=false`, `isOpen=false` — views that
 * gate inline rendering on `isOpen` simply hide their search bar.
 */
export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (ctx) return ctx;
  return {
    isOpen: false,
    open: () => undefined,
    close: () => undefined,
    toggle: () => undefined,
    hasSearch: false,
    hasActiveFilter: false,
  };
}
