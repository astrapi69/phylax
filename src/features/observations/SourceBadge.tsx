import { useTranslation } from 'react-i18next';
import type { Source } from '../../domain';

interface SourceBadgeProps {
  source: Source;
}

const STYLES: Record<Exclude<Source, 'user'>, string> = {
  medical:
    'bg-teal-100 text-teal-900 dark:bg-teal-900/60 dark:text-teal-100 border border-teal-300 dark:border-teal-700',
  ai: 'bg-violet-100 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100 border border-violet-300 dark:border-violet-700',
};

/**
 * Provenance marker for non-user observation sources. Renders nothing
 * for source='user' since that is the implicit default in a
 * self-managed profile and a badge would add visual noise.
 */
export function SourceBadge({ source }: SourceBadgeProps) {
  const { t } = useTranslation('observations');
  if (source === 'user') return null;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STYLES[source]}`}
    >
      {t(`source.${source}`)}
    </span>
  );
}
