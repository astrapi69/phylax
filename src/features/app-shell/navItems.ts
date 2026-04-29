/**
 * Single source of truth for the authenticated nav menu.
 *
 * Consumed by:
 *   - NavBar (desktop side panel)
 *   - NavDrawer (mobile hamburger drawer)
 *
 * Keeping the list here means a route added once shows up in both
 * surfaces without manual sync. The `i18n` field is a fully-qualified
 * `<namespace>:<key>` so each consumer's `useTranslation()` call
 * resolves cleanly regardless of its current default namespace.
 */
export interface NavItem {
  readonly to: string;
  readonly i18n: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/profile', i18n: 'app-shell:nav.profile' },
  { to: '/observations', i18n: 'app-shell:nav.observations' },
  { to: '/lab-values', i18n: 'app-shell:nav.lab-values' },
  { to: '/supplements', i18n: 'app-shell:nav.supplements' },
  { to: '/open-points', i18n: 'common:entity.open-points' },
  { to: '/timeline', i18n: 'app-shell:nav.timeline' },
  { to: '/documents', i18n: 'app-shell:nav.documents' },
  { to: '/chat', i18n: 'common:entity.ai-assistant' },
  { to: '/import', i18n: 'app-shell:nav.import' },
  { to: '/settings', i18n: 'app-shell:nav.settings' },
] as const;
