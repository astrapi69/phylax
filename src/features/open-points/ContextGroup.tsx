import type { OpenPoint } from '../../domain';
import { OpenPointItem } from './OpenPointItem';
import type { UseOpenPointFormResult } from './useOpenPointForm';

interface ContextGroupProps {
  context: string;
  items: OpenPoint[];
  /** Threaded through to each `OpenPointItem`. */
  form?: UseOpenPointFormResult;
}

/**
 * Section heading with count plus a list of open point items.
 * Renders nothing when the items list is empty.
 */
export function ContextGroup({ context, items, form }: ContextGroupProps) {
  if (items.length === 0) return null;

  const headingId = `context-${slugify(context)}-heading`;

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        <span>{context}</span>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({items.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id}>
            <OpenPointItem point={p} form={form} />
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
