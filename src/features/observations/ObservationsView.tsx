import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeGroup } from './ThemeGroup';
import { useObservations } from './useObservations';
import { ObservationsSortToggle } from './ObservationsSortToggle';
import { useSortPreference } from './useSortPreference';
import { sortObservations, type ObservationSection } from './sorting';

/** Window (ms) for treating an observation as "just committed" on mount. */
const HIGHLIGHT_WINDOW_MS = 5000;

/** How long the highlight stays visible before it fades back to normal. */
const HIGHLIGHT_FADE_MS = 2000;

/**
 * Read-only observations page at /observations.
 *
 * Default sort puts themes with recent activity (last 30 days) in a
 * "Kuerzlich aktualisiert" section at the top, so an AI commit lands
 * where the user can see it immediately. An alphabetical fallback
 * is one toggle away and persists per-view in localStorage.
 *
 * Observations whose updatedAt is within HIGHLIGHT_WINDOW_MS of the
 * view mount get a transient green background that fades back to
 * neutral after HIGHLIGHT_FADE_MS. This is the subtle "it landed"
 * signal after an AI commit: no auto-scroll, no banner, just a hint
 * the eye can follow.
 */
export function ObservationsView() {
  const { t } = useTranslation('observations');
  const { state } = useObservations();
  const [mode, setMode] = useSortPreference('observations');

  // Capture mount time ONCE. Used both to decide the initial highlight
  // set and to key the fade-out timer. Re-mounts (navigation away + back)
  // reset it, which is correct: each visit gets its own highlight window.
  const mountedAtRef = useRef<number>(Date.now());
  const [highlightVisible, setHighlightVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setHighlightVisible(false), HIGHLIGHT_FADE_MS);
    return () => clearTimeout(timer);
  }, []);

  const highlightedIds = useMemo<ReadonlySet<string>>(() => {
    if (!highlightVisible) return new Set<string>();
    if (state.kind !== 'loaded') return new Set<string>();
    const cutoff = mountedAtRef.current - HIGHLIGHT_WINDOW_MS;
    const ids = new Set<string>();
    for (const group of state.groups) {
      for (const obs of group.observations) {
        if (obs.updatedAt >= cutoff) ids.add(obs.id);
      }
    }
    return ids;
  }, [state, highlightVisible]);

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
        {t('loading')}
      </div>
    );
  }

  if (state.kind === 'error') {
    if (state.error.kind === 'generic') {
      console.error('[ObservationsView]', state.error.detail);
    }
    const message =
      state.error.kind === 'no-profile' ? t('common:error.no-profile') : t('error.load-failed');
    return (
      <div
        role="alert"
        className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      >
        {message}
      </div>
    );
  }

  const sections = sortObservations(state.groups, mode);

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
        {state.groups.length > 0 && <ObservationsSortToggle mode={mode} onChange={setMode} />}
      </header>

      {state.groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <Section
              key={section.label ?? 'single'}
              section={section}
              highlightedIds={highlightedIds}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function Section({
  section,
  highlightedIds,
}: {
  section: ObservationSection;
  highlightedIds: ReadonlySet<string>;
}) {
  const { t } = useTranslation('observations');
  const hasLabel = section.label !== null;
  const headingText = section.label ? t(`section.${section.label}`) : '';
  // Rendered as a styled <p>, not a heading, so the theme <h2>s stay
  // the top-level content headings inside each section.
  return (
    <div className="space-y-8">
      {hasLabel && (
        <p
          data-testid={`section-heading-${section.label}`}
          className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
        >
          {headingText}
        </p>
      )}
      {section.themeGroups.map((group) => (
        <ThemeGroup
          key={group.theme}
          theme={group.theme}
          observations={group.observations}
          highlightedIds={highlightedIds}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation('observations');
  return (
    <div className="rounded-sm border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
      <p>{t('empty.body')}</p>
      <p className="mt-2">
        <Link
          to="/import"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t('empty.cta')}
        </Link>
        {t('empty.suffix')}
      </p>
    </div>
  );
}
