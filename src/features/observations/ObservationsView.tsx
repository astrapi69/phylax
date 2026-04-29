import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  findMatchRanges,
  isDateRangeActive,
  parseDateRange,
  splitQuery,
  useUrlSearchParam,
  type DateRange,
  type MatchRange,
} from '../../lib';
import {
  DateRangeFilter,
  EmptyStatePanel,
  ListSkeleton,
  SearchIcon,
  SearchInput,
} from '../../ui';
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
  // `useUrlSearchParam` owns the push-vs-replace decision (settle-flag
  // pattern: first keystroke after 500ms idle commits a history entry,
  // subsequent keystrokes replace) so rapid typing does not spam
  // history while completed searches stay navigable via Back/Forward.
  // `useDeferredValue` defers the filter computation by one render so
  // typing stays responsive on large lists.
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const setQuery = useUrlSearchParam('q', query, setSearchParams);

  // Date range filter (O-18) lives in the URL alongside ?q. Each
  // change replaces the URL entry rather than pushing a new history
  // step: date inputs are typically used in a "session" where the
  // user picks from-date, then to-date, then maybe revises one
  // before settling. Pushing per change would spam history.
  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';

  // P-22a two-stage progressive disclosure.
  //
  //   Stage 0: only the magnifier toggle is visible. If a filter is
  //            active (URL-driven or preserved across collapses), a
  //            small dot on the magnifier signals "filter set, UI
  //            hidden" — see `filterActive` below.
  //   Stage 1: search input + calendar toggle visible alongside the
  //            magnifier. Date inputs hidden.
  //   Stage 2: search input + date inputs both visible.
  //
  // Initial stage mirrors the URL so a shared link / refresh /
  // Back navigation drops the user into the highest stage their
  // params imply (no point hiding inputs whose values they came
  // here to see).
  //
  // Click cascades:
  //   - Magnifier (any stage > 0)        → collapse to 0, preserve values.
  //   - Magnifier at stage 0             → expand to 1.
  //   - Calendar at stage 1              → expand to 2.
  //   - X (in SearchInput) / Escape-non-empty deferred to default → see SearchInput.
  //   - Global clear (X handled here)    → clear query + clear dates + collapse to 0.
  const initialStageRef = useRef<0 | 1 | 2>(
    fromParam !== '' || toParam !== '' ? 2 : query !== '' ? 1 : 0,
  );
  const [stage, setStage] = useState<0 | 1 | 2>(initialStageRef.current);
  const filterActive = query !== '' || fromParam !== '' || toParam !== '';
  const showFilterIndicator = stage === 0 && filterActive;

  const collapseToStageZero = () => setStage(0);
  const onMagnifierClick = () => {
    if (stage === 0) setStage(1);
    else collapseToStageZero();
  };
  const onCalendarClick = () => {
    if (stage === 1) setStage(2);
  };
  const clearAllAndCollapse = () => {
    setQuery('');
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('q');
        params.delete('from');
        params.delete('to');
        return params;
      },
      { replace: true },
    );
    setStage(0);
  };
  const dateRange: DateRange = useMemo(() => parseDateRange(searchParams), [searchParams]);
  const setDateParam = (key: 'from' | 'to', value: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === '') params.delete(key);
        else params.set(key, value);
        return params;
      },
      { replace: true },
    );
  };

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
    return filterObservations(state.groups, { query: deferredQuery, dateRange });
  }, [state, deferredQuery, dateRange]);

  const isFiltering = deferredQuery.trim() !== '' || isDateRangeActive(dateRange);
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
    return <ListSkeleton variant="card" count={4} ariaLabel={t('loading.aria-label')} />;
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
          {/* Sticky search bar: stays in view while user scrolls the
           *  filtered list so the input, counter and nav buttons remain
           *  reachable. `top-14` clears the fixed AppShell Header
           *  (h-14, z-40); `z-30` sits above scrolling content but
           *  below modals (z-50+). Background matches the AppShell
           *  body color so the sticky region reads as continuous with
           *  the page surface but visibly opaque against scrolling
           *  content beneath. `-mx-4 px-4` extends the opaque region
           *  to the parent's padding so observations do not bleed
           *  through the gutters. */}
          <div className="sticky top-14 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-950">
            {/* P-22a two-stage progressive disclosure.
             *
             *  Layout: outer wrapper is `justify-between` with two
             *  inner clusters. Left cluster carries the match
             *  counter + Up/Down nav (only present when a search
             *  query is active and produced matches). Right cluster
             *  is always present; it carries the date filter
             *  (Stage 2 only), the search input + calendar toggle
             *  (Stage 1 onward), and the magnifier toggle anchored
             *  to the right edge. Right-anchored magnifier matches
             *  the standard "actions on the right" rhythm (theme +
             *  lock are also right-aligned in the Header).
             *
             *  Default chrome (Stage 0) is the magnifier alone.
             *  Click expands to Stage 1; the search input + calendar
             *  toggle render alongside, growing leftward from the
             *  magnifier. Calendar click expands to Stage 2,
             *  revealing the date inputs further to the left. A
             *  subsequent magnifier click cascades all the way back
             *  to Stage 0 and preserves the values (Q15 lock); the
             *  global X clear button on the search input clears
             *  query + dates and collapses to Stage 0 (Q15). When
             *  the bar is collapsed but a filter remains active
             *  (e.g. via shared `?q=` link or a previous expand-
             *  then-magnifier-click), a small dot on the magnifier
             *  signals "filter set, UI hidden" (Q14). */}
            <div className="flex flex-wrap items-center gap-3">
              {isFiltering && totalMatches > 0 && (
                <p
                  role="status"
                  aria-live="polite"
                  data-testid="search-match-count"
                  className="text-xs text-gray-600 dark:text-gray-400"
                >
                  {totalMatches === 1
                    ? t('search.single-match')
                    : t('search.match-count-treffer', {
                        count: activeIndex,
                        total: totalMatches,
                      })}
                </p>
              )}
              {isFiltering && totalMatches >= 2 && (
                <>
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
            <div className="flex flex-wrap items-center gap-3">
              {stage >= 2 && (
                <DateRangeFilter
                  from={fromParam}
                  to={toParam}
                  onFromChange={(v) => setDateParam('from', v)}
                  onToChange={(v) => setDateParam('to', v)}
                  fromLabel={t('date-range.from')}
                  toLabel={t('date-range.to')}
                  groupAriaLabel={t('date-range.aria-label')}
                />
              )}
              {stage >= 1 && (
                <>
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder={t('search.placeholder')}
                    ariaLabel={t('search.aria-label')}
                    clearLabel={t('search.clear')}
                    onEnter={next}
                    onShiftEnter={prev}
                    onEscapeWhenEmpty={collapseToStageZero}
                    onClear={clearAllAndCollapse}
                    autoFocus
                  />
                  <CalendarToggle
                    stage={stage}
                    onClick={onCalendarClick}
                    openLabel={t('search.dates-open')}
                    alreadyOpenLabel={t('search.dates-shown')}
                  />
                </>
              )}
              <SearchToggle
                stage={stage}
                showActiveIndicator={showFilterIndicator}
                onClick={onMagnifierClick}
                openLabel={t('common:search.open')}
                closeLabel={t('common:search.close')}
                activeIndicatorLabel={t('search.filter-active-indicator')}
              />
            </div>
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

function SearchToggle({
  stage,
  showActiveIndicator,
  onClick,
  openLabel,
  closeLabel,
  activeIndicatorLabel,
}: {
  stage: 0 | 1 | 2;
  showActiveIndicator: boolean;
  onClick: () => void;
  openLabel: string;
  closeLabel: string;
  activeIndicatorLabel: string;
}) {
  const expanded = stage > 0;
  const label = expanded ? closeLabel : openLabel;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        showActiveIndicator ? `${label} (${activeIndicatorLabel})` : label
      }
      aria-expanded={expanded}
      title={label}
      data-testid="search-toggle"
      className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {expanded ? <CloseIcon /> : <SearchIcon />}
      {showActiveIndicator && (
        <span
          aria-hidden="true"
          data-testid="search-toggle-active-indicator"
          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400"
        />
      )}
    </button>
  );
}

function CalendarToggle({
  stage,
  onClick,
  openLabel,
  alreadyOpenLabel,
}: {
  stage: 0 | 1 | 2;
  onClick: () => void;
  openLabel: string;
  alreadyOpenLabel: string;
}) {
  const opened = stage >= 2;
  const label = opened ? alreadyOpenLabel : openLabel;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={opened}
      aria-pressed={opened}
      title={label}
      disabled={opened}
      data-testid="calendar-toggle"
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
    >
      <CalendarIcon />
    </button>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1z" />
    </svg>
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
    <EmptyStatePanel
      title={t('empty.title')}
      body={t('empty.body')}
      cta={
        <p>
          <Link
            to="/import"
            className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('empty.cta')}
          </Link>
          {t('empty.suffix')}
        </p>
      }
    />
  );
}
