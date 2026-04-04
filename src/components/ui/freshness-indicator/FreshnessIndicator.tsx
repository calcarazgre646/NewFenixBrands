/**
 * components/ui/freshness-indicator/FreshnessIndicator.tsx
 *
 * Indicador de freshness para vistas que no tienen lastDataDay/lastDataMonth
 * (ej: Centro de Acciones, Depósitos).
 *
 * Muestra: ● Actualizado hace 45 min
 */
import type { FreshnessStatus } from "@/domain/freshness/types";
import { formatRelativeTime } from "@/domain/freshness/classify";

const STATUS_DOT_CLASS: Record<FreshnessStatus, string> = {
  ok:      "bg-green-400",
  stale:   "bg-amber-400",
  risk:    "bg-red-400",
  unknown: "",
};

interface FreshnessIndicatorProps {
  /** Timestamp del último refresh. */
  refreshedAt?: Date;
  /** Estado computado. */
  status: FreshnessStatus;
}

export function FreshnessIndicator({
  refreshedAt,
  status,
}: FreshnessIndicatorProps) {
  if (status === "unknown" || !refreshedAt) return null;

  const dotClass = STATUS_DOT_CLASS[status];
  const timeLabel = formatRelativeTime(refreshedAt);

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-gray-400 dark:text-gray-500">
      {dotClass && (
        <span
          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
          aria-label={`Freshness: ${status}`}
        />
      )}
      Actualizado {timeLabel}
    </span>
  );
}
