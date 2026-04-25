import type { Observation } from '../../domain';
import { ObservationCard } from './ObservationCard';
import type { UseObservationFormResult } from './useObservationForm';

interface ThemeGroupProps {
  theme: string;
  observations: Observation[];
  /**
   * IDs of observations that should render with the "just-committed"
   * highlight. Passed through to ObservationCard unchanged.
   */
  highlightedIds?: ReadonlySet<string>;
  /** O-10 form hook for edit/delete actions; threaded to each card. */
  form?: UseObservationFormResult;
}

/**
 * Section header plus a list of observation cards for a single theme.
 *
 * A single-observation group auto-expands its card: a collapse-then-expand
 * interaction for a one-item group is friction without benefit.
 */
export function ThemeGroup({ theme, observations, highlightedIds, form }: ThemeGroupProps) {
  const headingId = `theme-${slugify(theme)}-heading`;
  const autoExpand = observations.length === 1;

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        <span>{theme}</span>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({observations.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {observations.map((obs) => (
          <li key={obs.id}>
            <ObservationCard
              observation={obs}
              defaultOpen={autoExpand}
              highlighted={highlightedIds?.has(obs.id) ?? false}
              form={form}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
