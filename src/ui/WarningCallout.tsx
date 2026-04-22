import type { ReactNode } from 'react';

export type WarningSeverity = 'info' | 'warning' | 'danger';

interface WarningCalloutProps {
  severity?: WarningSeverity;
  title?: string;
  children: ReactNode;
  className?: string;
}

const SEVERITY_CLASSES: Record<WarningSeverity, string> = {
  info: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100',
  warning:
    'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100',
  danger:
    'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100',
};

const ROLE_BY_SEVERITY: Record<WarningSeverity, 'note' | 'alert'> = {
  info: 'note',
  warning: 'alert',
  danger: 'alert',
};

export function WarningCallout({
  severity = 'warning',
  title,
  children,
  className,
}: WarningCalloutProps) {
  const role = ROLE_BY_SEVERITY[severity];
  return (
    <div
      role={role}
      className={`rounded-sm border p-3 text-sm ${SEVERITY_CLASSES[severity]}${className ? ` ${className}` : ''}`}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}
