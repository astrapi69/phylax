import type { Supplement, SupplementCategory } from '../../domain';
import { SupplementCard } from './SupplementCard';

interface SupplementCategoryGroupProps {
  category: SupplementCategory;
  label: string;
  supplements: Supplement[];
}

/**
 * Section heading with count plus a list of supplement cards.
 * Renders nothing when the supplements list is empty.
 */
export function SupplementCategoryGroup({
  category,
  label,
  supplements,
}: SupplementCategoryGroupProps) {
  if (supplements.length === 0) return null;

  const muted = category === 'paused';
  const headingId = `supplements-${category}-heading`;

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        <span>{label}</span>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({supplements.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {supplements.map((s) => (
          <li key={s.id}>
            <SupplementCard supplement={s} muted={muted} />
          </li>
        ))}
      </ul>
    </section>
  );
}
