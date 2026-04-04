/**
 * features/executive/components/DataFreshnessTag.tsx
 *
 * Indicador del último día con datos reales + salud del cron.
 *
 * Texto: "Datos hasta Jue 2 Abr" — verdad del dato.
 * Punto coloreado (verde/amarillo/rojo) — salud del refresh de MVs.
 * Tooltip del punto (React): "Actualizado hace 45 min".
 */
import { MONTH_SHORT } from "@/domain/period/helpers";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";
import type { FreshnessStatus } from "@/domain/freshness/types";
import { formatRelativeTime } from "@/domain/freshness/classify";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const STATUS_DOT_CLASS: Record<FreshnessStatus, string> = {
  ok:      "bg-green-400",
  stale:   "bg-amber-400",
  risk:    "bg-red-400",
  unknown: "",
};

interface DataFreshnessTagProps {
  /** Último día con datos reales (null si no aplica). */
  lastDataDay: number | null;
  /** Mes del último dato real (1-12). */
  lastDataMonth: number | null;
  /** Estado de refresh de MVs. Si no se pasa, no muestra punto. */
  freshnessStatus?: FreshnessStatus;
  /** Timestamp del último refresh de MV. Se muestra como tooltip del punto. */
  refreshedAt?: Date;
}

export function DataFreshnessTag({
  lastDataDay,
  lastDataMonth,
  freshnessStatus,
  refreshedAt,
}: DataFreshnessTagProps) {
  if (lastDataDay == null || lastDataMonth == null) return null;

  const year = new Date().getFullYear();
  const date = new Date(year, lastDataMonth - 1, lastDataDay);
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MONTH_SHORT[lastDataMonth];

  const dotClass = freshnessStatus ? STATUS_DOT_CLASS[freshnessStatus] : "";
  const tooltipText = refreshedAt ? `Actualizado ${formatRelativeTime(refreshedAt)}` : "";

  const dot = dotClass ? (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
      aria-label={tooltipText || `Estado: ${freshnessStatus}`}
    />
  ) : null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-gray-400 dark:text-gray-500">
      {dot && tooltipText ? (
        <Tooltip content={tooltipText} position="bottom">
          {dot}
        </Tooltip>
      ) : dot}
      Datos hasta {dayName} {lastDataDay} {monthName}
    </span>
  );
}
