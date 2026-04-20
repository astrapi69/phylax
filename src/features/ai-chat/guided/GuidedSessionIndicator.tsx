import { useTranslation } from 'react-i18next';
import type { GuidedSection, GuidedSessionState } from './GuidedSessionState';

interface GuidedSessionIndicatorProps {
  state: GuidedSessionState;
}

const SECTION_ORDER: GuidedSection[] = ['observations', 'supplements', 'open-points'];

/**
 * Three pills that reflect which sections have received at least one
 * successful commit during the active guided session.
 *
 * Two states only: pending (gray outline) and completed (green filled). No
 * active-section highlight - we do not try to guess the section the AI is
 * currently asking about.
 */
export function GuidedSessionIndicator({ state }: GuidedSessionIndicatorProps) {
  const { t } = useTranslation('ai-chat');
  if (!state.active) return null;

  return (
    <ul
      data-testid="guided-session-indicator"
      className="flex flex-wrap items-center gap-1.5"
      aria-label={t('guided.indicator-aria-label')}
    >
      {SECTION_ORDER.map((section) => {
        const completed = state.sectionsCompleted.includes(section);
        const label = t(`guided.section.${section}`);
        const ariaLabel = completed
          ? t('guided.pill-aria-completed', { label })
          : t('guided.pill-aria-pending', { label });
        const classes = completed
          ? 'border-green-500 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-950/50 dark:text-green-200'
          : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400';
        return (
          <li
            key={section}
            data-testid={`guided-session-pill-${section}`}
            data-state={completed ? 'completed' : 'pending'}
            aria-label={ariaLabel}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}
          >
            <span aria-hidden="true">{completed ? '\u2713' : '\u25CB'}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
