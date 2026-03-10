import type { ReactNode } from "react";

interface SectionProps {
  label: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({
  label,
  description,
  actions,
  children,
  className = "",
}: SectionProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {label}
          </span>
          {description && (
            <span className="mt-0.5 text-xs text-gray-400 dark:text-gray-600">
              {description}
            </span>
          )}
        </div>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        {actions}
      </div>
      {children}
    </section>
  );
}
