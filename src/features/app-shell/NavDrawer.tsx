import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFocusTrap, useReturnFocus, useBodyScrollLock } from '../../ui';
import { useAIConfig } from '../ai-config';
import { NAV_ITEMS, filterNavItems } from './navItems';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base =
    'block min-h-[44px] rounded-sm px-4 py-3 text-base transition-colors no-underline';
  return isActive
    ? `${base} bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300`
    : `${base} text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100`;
}

/**
 * Mobile navigation drawer (BUG-02).
 *
 * Slides in from the left edge when the Header hamburger button is
 * tapped. Hosts every NAV_ITEM in a vertical stack with 44x44 minimum
 * touch targets. The previous bottom-nav approach squeezed 10 items
 * across a 360px viewport (~36px each, labels invisible); the drawer
 * scales independently of item count and matches the standard mobile
 * PWA pattern.
 *
 * Reuses the Modal primitive's a11y hooks rather than the Modal
 * shell itself: Modal centers content, drawer needs a left-edge
 * slide-in. The hooks are sufficient for the focus-trap +
 * scroll-lock + return-focus invariants.
 *
 * A11y:
 *   - role="dialog" + aria-modal="true" + aria-labelledby pinning
 *     to the drawer title
 *   - useFocusTrap keeps Tab/Shift+Tab inside the drawer panel
 *   - useReturnFocus restores focus to the hamburger button on close
 *   - useBodyScrollLock prevents the page behind the drawer from
 *     scrolling
 *   - Escape key closes (handled inline; no Modal closeOnEscape
 *     equivalent on the hooks layer)
 *   - Backdrop click closes
 *   - Each nav-item click calls onClose so route changes also
 *     dismiss the drawer (matches the standard mobile UX)
 *
 * Mobile-only: hidden via the parent's `md:hidden` boundary
 * (AppShell renders the hamburger button only on `md:hidden`, which
 * is the only path that can set `open=true`). Desktop users get
 * NAV_ITEMS via the always-visible NavBar side panel.
 */
export function NavDrawer({ open, onClose }: NavDrawerProps) {
  const { t } = useTranslation('app-shell');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  // BUG-07: hide AI-gated items until the user has saved an API key.
  const { state: aiState } = useAIConfig();
  const items = useMemo(
    () => filterNavItems(NAV_ITEMS, { aiConfigured: aiState.status === 'configured' }),
    [aiState.status],
  );

  useFocusTrap(panelRef, open);
  useReturnFocus(open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden" data-testid="nav-drawer">
      <div
        aria-hidden="true"
        onClick={onClose}
        data-testid="nav-drawer-backdrop"
        className="absolute inset-0 bg-black/50"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute top-0 bottom-0 left-0 flex w-72 max-w-[80vw] flex-col gap-1 border-r border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="mb-2 flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
          {/*
            BUG-06: tapping the top-left of the drawer (where the
            Header's hamburger button sits) is the natural mobile
            gesture to close the drawer - same position as the open
            trigger. Burger here mirrors that position. The previous
            right-side X button was removed in BUG-06 follow-up:
            two redundant close affordances were UX clutter and the
            burger position is what users reach for. Backdrop click
            + Escape remain as alternative dismiss paths.
           */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('drawer.close')}
            data-testid="nav-drawer-burger-close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <BurgerIcon />
          </button>
          <h2
            id={titleId}
            className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('drawer.title')}
          </h2>
        </div>
        <nav aria-label={t('nav.aria-label')} className="flex flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={navLinkClass}
              data-testid={`nav-drawer-link-${item.to}`}
            >
              {t(item.i18n)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>,
    document.body,
  );
}

function BurgerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5" />
    </svg>
  );
}
