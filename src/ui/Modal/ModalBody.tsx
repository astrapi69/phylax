import type { ReactNode } from 'react';

export interface ModalBodyProps {
  children: ReactNode;
  /** Additional classes appended to the default body classes. */
  className?: string;
}

/**
 * Scrollable content area for `<Modal>`. Provides default padding +
 * `overflow-y-auto`; the parent `Modal` clamps `max-h-[90vh]` so
 * content scrolls within the viewport.
 */
export function ModalBody({ children, className }: ModalBodyProps) {
  return <div className={`flex-1 overflow-y-auto px-6 py-4 ${className ?? ''}`}>{children}</div>;
}
