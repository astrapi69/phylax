import type { ReactNode } from 'react';

export interface ModalFooterProps {
  children: ReactNode;
}

/**
 * Right-aligned button row at the bottom of `<Modal>`. Standard
 * layout for cancel/confirm pairs.
 */
export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
      {children}
    </footer>
  );
}
