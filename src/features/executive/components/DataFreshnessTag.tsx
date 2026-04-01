/**
 * features/executive/components/DataFreshnessTag.tsx
 *
 * Indicador sutil del último día con datos reales.
 * Se muestra siempre que haya un lastDataDay disponible (año actual con datos).
 *
 * Ejemplo: "Datos hasta Vie 28 Mar"
 */
import { MONTH_SHORT } from "@/domain/period/helpers";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface DataFreshnessTagProps {
  /** Último día con datos reales (null si no aplica). */
  lastDataDay: number | null;
  /** Mes del último dato real (1-12). */
  lastDataMonth: number | null;
}

export function DataFreshnessTag({
  lastDataDay,
  lastDataMonth,
}: DataFreshnessTagProps) {
  if (lastDataDay == null || lastDataMonth == null) return null;

  const year = new Date().getFullYear();
  const date = new Date(year, lastDataMonth - 1, lastDataDay);
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MONTH_SHORT[lastDataMonth];

  return (
    <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
      Datos hasta {dayName} {lastDataDay} {monthName}
    </span>
  );
}
