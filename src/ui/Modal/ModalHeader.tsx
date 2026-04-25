import type { ReactNode } from 'react';

export interface ModalHeaderProps {
  /** Title id; must match the `titleId` passed to the parent `Modal`. */
  titleId: string;
  /** Visible title. */
  children: ReactNode;
  /** Optional description rendered below the title. Pair with parent's `descriptionId`. */
  description?: ReactNode;
  descriptionId?: string;
  /** Optional `data-testid` on the title element. */
  titleTestId?: string;
}

/**
 * Standard header layout for `<Modal>`. Renders the title element
 * with the matching `id` plus optional description paragraph.
 */
export function ModalHeader({
  titleId,
  children,
  description,
  descriptionId,
  titleTestId,
}: ModalHeaderProps) {
  return (
    <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <h2
        id={titleId}
        data-testid={titleTestId}
        className="text-lg font-bold text-gray-900 dark:text-gray-100"
      >
        {children}
      </h2>
      {description ? (
        <p id={descriptionId} className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      ) : null}
    </header>
  );
}
