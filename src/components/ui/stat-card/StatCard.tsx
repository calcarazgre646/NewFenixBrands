import type { ReactNode } from "react";

type StatCardVariant = "neutral" | "positive" | "negative" | "accent-positive" | "accent-negative";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: StatCardVariant;
  icon?: ReactNode;
  className?: string;
}

const variantStyles: Record<
  StatCardVariant,
  { container: string; value: string }
> = {
  neutral: {
    container:
      "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
    value: "text-gray-900 dark:text-white",
  },
  positive: {
    container:
      "border-success-200 bg-success-50 dark:border-success-500/20 dark:bg-success-500/10",
    value: "text-success-700 dark:text-success-400",
  },
  negative: {
    container:
      "border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10",
    value: "text-error-700 dark:text-error-400",
  },
  "accent-positive": {
    container:
      "border-gray-200 border-l-[3px] border-l-success-400 bg-white dark:border-gray-700 dark:border-l-success-400 dark:bg-gray-800",
    value: "text-success-700 dark:text-success-400",
  },
  "accent-negative": {
    container:
      "border-gray-200 border-l-[3px] border-l-error-400 bg-white dark:border-gray-700 dark:border-l-error-400 dark:bg-gray-800",
    value: "text-error-700 dark:text-error-400",
  },
};

export function StatCard({
  label,
  value,
  sub,
  variant = "neutral",
  icon,
  className = "",
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`rounded-2xl border p-5 transition-colors duration-[var(--duration-fast)] hover:shadow-theme-xs ${styles.container} ${className}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {label}
        </p>
        {icon && (
          <span className="text-gray-300 dark:text-gray-600">{icon}</span>
        )}
      </div>
      <p
        className={`break-words text-xl font-bold leading-tight tabular-nums ${styles.value}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {sub}
        </p>
      )}
    </div>
  );
}
