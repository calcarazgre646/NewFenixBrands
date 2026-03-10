interface SkeletonProps {
  variant?: "text" | "card" | "table-row" | "circle";
  width?: string;
  height?: string;
  count?: number;
  className?: string;
}

const variantDefaults: Record<
  NonNullable<SkeletonProps["variant"]>,
  string
> = {
  text: "h-4 w-full rounded",
  card: "h-28 w-full rounded-2xl",
  "table-row": "h-10 w-full rounded",
  circle: "h-10 w-10 rounded-full",
};

export function Skeleton({
  variant = "text",
  width,
  height,
  count = 1,
  className = "",
}: SkeletonProps) {
  const baseClasses = variantDefaults[variant];

  const elements = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${baseClasses} ${className}`}
      style={{
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      }}
      role="status"
      aria-label="Cargando..."
    />
  ));

  if (count === 1) return elements[0];

  return <div className="space-y-2">{elements}</div>;
}

/** Page-level skeleton: header + card grid + large content area */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-[var(--spacing-page-x)]">
      <Skeleton variant="text" height="2rem" width="40%" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton variant="card" count={4} />
      </div>
      <Skeleton variant="card" height="20rem" />
    </div>
  );
}
