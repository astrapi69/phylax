import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { findMatchRanges, splitQuery, type MatchRange } from '../../lib';
import { SearchInput } from '../../ui';
import { ThemeGroup } from './ThemeGroup';
import { useObservations } from './useObservations';
import { ObservationsSortToggle } from './ObservationsSortToggle';
import { useSortPreference } from './useSortPreference';
import { sortObservations, type ObservationSection } from './sorting';
import { useObservationForm } from './useObservationForm';
import { ObservationForm } from './ObservationForm';
import { ObservationDeleteDialog } from './ObservationDeleteDialog';
import { AddObservationButton } from './AddObservationButton';
import { filterObservations } from './filterObservations';
import { useSearchQueryUrl } from './useSearchQueryUrl';
import { useActiveMatch } from './useActiveMatch';

/** Window (ms) for treating an observation as "just committed" on mount. */
const HIGHLIGHT_WINDOW_MS = 5000;

/** How long the highlight stays visible before it fades back to normal. */
const HIGHLIGHT_FADE_MS = 2000;

/**
 * Per-field match metadata used to assign a sequential global index
 * to every visible mark. Keys: `theme:<theme>` for theme headings,
 * `<observationId>:fact` and `<observationId>:pattern` for the two
 * Markdown-rendered observation fields.
 */
interface FieldMatch {
  ranges: MatchRange[];
  startIndex: number;
}
export type MatchPlan = ReadonlyMap<string, FieldMatch>;

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
 *
 * P-19 search: SearchInput at the top filters the visible list (O-17)
 * and the rendered theme / fact / pattern text gets `<mark>` highlights
 * around each match. A sequential global match index lets the user
 * navigate via Up / Down buttons or Enter / Shift+Enter; the active
 * match scrolls into view and gets a distinct orange/red highlight.
 * Observation cards force open while a query is active so matches
 * inside the disclosure body are visible.
 */
export function ObservationsView() {
  const { t } = useTranslation('observations');
  const { state, refetch } = useObservations();
  const [mode, setMode] = useSortPreference('observations');
  const form = useObservationForm({ onCommitted: refetch });

  // Search query persists in the URL as `?q=<term>` so back/forward,
  // refresh and a shared link all restore the filtered view.
  // `useSearchQueryUrl` owns the push-vs-replace decision (settle-flag
  // pattern: first keystroke after 500ms idle commits a history entry,
  // subsequent keystrokes replace) so rapid typing does not spam
  // history while completed searches stay navigable via Back/Forward.
  // `useDeferredValue` defers the filter computation by one render so
  // typing stays responsive on large lists.
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const setQuery = useSearchQueryUrl(query, setSearchParams);

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

  const filterResult = useMemo(() => {
    if (state.kind !== 'loaded') return null;
    return filterObservations(state.groups, deferredQuery);
  }, [state, deferredQuery]);

  const isFiltering = deferredQuery.trim() !== '';
  const sections = useMemo(
    () => (filterResult ? sortObservations(filterResult.groups, mode) : []),
    [filterResult, mode],
  );

  // Build the per-field match plan in display order so each rendered
  // mark gets a sequential 1-based global index. Total match count
  // here drives the navigation counter; filter-level matchCount is
  // observation count which we no longer surface in the header while
  // P-19 navigation is active.
  const { matchPlan, totalMatches } = useMemo(() => {
    const plan = new Map<string, FieldMatch>();
    if (!isFiltering) return { matchPlan: plan as MatchPlan, totalMatches: 0 };
    const terms = splitQuery(deferredQuery);
    if (terms.length === 0) return { matchPlan: plan as MatchPlan, totalMatches: 0 };
    let cursor = 1;
    for (const section of sections) {
      for (const group of section.themeGroups) {
        const themeRanges = findMatchRanges(group.theme, terms);
        if (themeRanges.length > 0) {
          plan.set(`theme:${group.theme}`, { ranges: themeRanges, startIndex: cursor });
          cursor += themeRanges.length;
        }
        for (const obs of group.observations) {
          const factRanges = findMatchRanges(obs.fact, terms);
          if (factRanges.length > 0) {
            plan.set(`${obs.id}:fact`, { ranges: factRanges, startIndex: cursor });
            cursor += factRanges.length;
          }
          const patternRanges = findMatchRanges(obs.pattern, terms);
          if (patternRanges.length > 0) {
            plan.set(`${obs.id}:pattern`, { ranges: patternRanges, startIndex: cursor });
            cursor += patternRanges.length;
          }
        }
      }
    }
    return { matchPlan: plan as MatchPlan, totalMatches: cursor - 1 };
  }, [sections, isFiltering, deferredQuery]);

  const { activeIndex, scrollSignal, next, prev } = useActiveMatch(deferredQuery, totalMatches);

  // When the user explicitly navigates (next / prev), scroll the now-
  // active mark into view. The mark element carries data-match-index
  // matching the activeIndex; if it is missing (e.g., source-level
  // count over-counted because a match sat inside a Markdown syntax
  // marker), the lookup returns null and we no-op silently.
  useEffect(() => {
    if (scrollSignal === 0) return;
    if (activeIndex === 0) return;
    const target = document.querySelector(`mark[data-match-index="${activeIndex}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollSignal, activeIndex]);

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

  if (!filterResult) return null;

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {state.groups.length > 0 && <ObservationsSortToggle mode={mode} onChange={setMode} />}
          <AddObservationButton form={form} />
        </div>
      </header>

      {state.groups.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t('search.placeholder')}
              ariaLabel={t('search.aria-label')}
              clearLabel={t('search.clear')}
              onEnter={next}
              onShiftEnter={prev}
            />
            {isFiltering && totalMatches > 0 && (
              <>
                <p
                  role="status"
                  aria-live="polite"
                  data-testid="search-match-count"
                  className="text-xs text-gray-600 dark:text-gray-400"
                >
                  {t('search.match-count-treffer', {
                    count: activeIndex,
                    total: totalMatches,
                  })}
                </p>
                <NavButton
                  onClick={prev}
                  ariaLabel={t('search.prev-match')}
                  testId="search-prev"
                  iconRotation="up"
                />
                <NavButton
                  onClick={next}
                  ariaLabel={t('search.next-match')}
                  testId="search-next"
                  iconRotation="down"
                />
              </>
            )}
          </div>

          {isFiltering && filterResult.matchCount === 0 ? (
            <NoMatchesState query={deferredQuery} />
          ) : (
            <div className="space-y-10">
              {sections.map((section) => (
                <Section
                  key={section.label ?? 'single'}
                  section={section}
                  highlightedIds={highlightedIds}
                  form={form}
                  query={deferredQuery}
                  matchPlan={matchPlan}
                  activeMatchIndex={isFiltering ? activeIndex : null}
                  forceOpen={isFiltering}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ObservationForm form={form} />
      <ObservationDeleteDialog form={form} />
    </article>
  );
}

function NavButton({
  onClick,
  ariaLabel,
  testId,
  iconRotation,
}: {
  onClick: () => void;
  ariaLabel: string;
  testId: string;
  iconRotation: 'up' | 'down';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-testid={testId}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
        style={{ transform: iconRotation === 'up' ? 'rotate(180deg)' : undefined }}
      >
        <path d="M3.204 5h9.592L8 10.481zm-.753.659l4.796 5.48a1 1 0 0 0 1.506 0l4.796-5.48c.566-.647.106-1.659-.753-1.659H3.204a1 1 0 0 0-.753 1.659" />
      </svg>
    </button>
  );
}

function NoMatchesState({ query }: { query: string }) {
  const { t } = useTranslation('observations');
  return (
    <div
      role="status"
      data-testid="search-no-matches"
      className="rounded-sm border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
    >
      {t('search.no-matches', { query: query.trim() })}
    </div>
  );
}

function Section({
  section,
  highlightedIds,
  form,
  query,
  matchPlan,
  activeMatchIndex,
  forceOpen,
}: {
  section: ObservationSection;
  highlightedIds: ReadonlySet<string>;
  form: ReturnType<typeof useObservationForm>;
  query: string;
  matchPlan: MatchPlan;
  activeMatchIndex: number | null;
  forceOpen: boolean;
}) {
  const { t } = useTranslation('observations');
  const hasLabel = section.label !== null;
  const headingText = section.label ? t(`section.${section.label}`) : '';
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
          form={form}
          query={query}
          matchPlan={matchPlan}
          activeMatchIndex={activeMatchIndex}
          forceOpen={forceOpen}
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
