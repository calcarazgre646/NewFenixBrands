import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      {icon && (
        <div className="mb-4 text-gray-300 dark:text-gray-600">{icon}</div>
      )}
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-gray-400 dark:text-gray-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
