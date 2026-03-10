import type { ReactNode } from "react";

interface TabItem<T extends string = string> {
  key: T;
  label: string;
  icon?: ReactNode;
}

interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export function Tabs<T extends string = string>({
  items,
  active,
  onChange,
  size = "md",
  className = "",
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={`flex gap-1 border-b border-gray-200 dark:border-gray-700 ${className}`}
    >
      {items.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`relative inline-flex items-center gap-1.5 font-medium transition-colors duration-[var(--duration-fast)] ${sizeClasses[size]} ${
              isActive
                ? "text-brand-600 dark:text-brand-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export type { TabItem };
