import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "outlined" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}

const variantClasses = {
  default:
    "border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
  outlined:
    "border border-gray-200 bg-transparent dark:border-gray-700",
  elevated:
    "border border-gray-200 bg-white shadow-theme-sm dark:border-gray-700 dark:bg-gray-800",
} as const;

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export function Card({
  children,
  variant = "default",
  padding = "md",
  className = "",
}: CardProps) {
  return (
    <div
      className={`rounded-2xl transition-colors duration-[var(--duration-fast)] ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
