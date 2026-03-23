/**
 * features/executive/components/DataFreshnessTag.tsx
 *
 * Indicador sutil del último día con datos reales.
 * Solo se muestra cuando hay datos parciales del mes en curso.
 *
 * Ejemplo: "Datos hasta Vie 7 Mar"
 */
import { MONTH_SHORT } from "@/domain/period/helpers";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface DataFreshnessTagProps {
  /** Último día con datos reales en el mes actual (null si no aplica). */
  lastDataDay: number | null;
  /** Mes calendario actual (1-12) */
  calendarMonth: number;
  /** Hay datos parciales del mes en curso? */
  isPartialMonth: boolean;
}

export function DataFreshnessTag({
  lastDataDay,
  calendarMonth,
  isPartialMonth,
}: DataFreshnessTagProps) {
  if (!isPartialMonth || lastDataDay == null) return null;

  const year = new Date().getFullYear();
  const date = new Date(year, calendarMonth - 1, lastDataDay);
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MONTH_SHORT[calendarMonth];

  return (
    <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
      Datos hasta {dayName} {lastDataDay} {monthName}
    </span>
  );
}
