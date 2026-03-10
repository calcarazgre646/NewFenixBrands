/**
 * components/ui/badge/Badge.tsx
 *
 * Badge genérico reutilizable.
 * Usado en ActionQueueTable y LogisticsPage.
 */

interface BadgeProps {
  text: string;
  className: string;
}

export function Badge({ text, className }: BadgeProps) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {text}
    </span>
  );
}
