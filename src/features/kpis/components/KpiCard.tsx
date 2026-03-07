/**
 * features/kpis/components/KpiCard.tsx
 *
 * Tarjeta de KPI reutilizable.
 *
 * REGLA: Sin lógica de negocio. Solo formateo + layout.
 * El valor, el estado de loading y el error vienen del hook (KpiCardData).
 * El componente solo sabe cómo mostrarlo.
 */
import { formatKpiValue, formatChange } from "@/utils/format";
import type { KpiCardData } from "../hooks/useKpiDashboard";

interface KpiCardProps extends KpiCardData {
  periodLabel?: string;
}

export function KpiCard({
  title,
  value,
  unit,
  yoyPct,
  positiveDirection,
  isLoading,
  error,
  periodLabel,
}: KpiCardProps) {
  if (isLoading) {
    return <KpiCardSkeleton label={title} />;
  }

  const yoyColor = getYoyColor(yoyPct, positiveDirection);
  const yoyIcon  = getYoyIcon(yoyPct);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </span>
      </div>

      {/* Valor principal — "—" si hay error, valor formateado si hay datos */}
      <div className="mb-3 flex items-baseline gap-2">
        {error ? (
          <>
            <span
              className="text-2xl font-bold text-gray-300 dark:text-gray-700"
              title={error}
            >
              —
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-600" title={error}>
              sin datos
            </span>
          </>
        ) : (
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatKpiValue(value, unit)}
          </span>
        )}
      </div>

      {/* Footer: YoY + período */}
      <div className="flex items-center justify-between">
        {!error && yoyPct !== null ? (
          <span className={`flex items-center gap-1 text-sm font-medium ${yoyColor}`}>
            <span>{yoyIcon}</span>
            <span>{formatChange(yoyPct)} vs año ant.</span>
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-600">
            {error ? "" : "Sin comparación anual"}
          </span>
        )}

        {periodLabel && (
          <span className="text-xs text-gray-400 dark:text-gray-600">{periodLabel}</span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYoyColor(yoyPct: number | null, positiveDirection: "up" | "down"): string {
  if (yoyPct === null || yoyPct === 0) return "text-gray-500 dark:text-gray-400";
  const isPositiveChange = yoyPct > 0;
  const isGood = positiveDirection === "up" ? isPositiveChange : !isPositiveChange;
  return isGood
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
}

function getYoyIcon(yoyPct: number | null): string {
  if (yoyPct === null || yoyPct === 0) return "—";
  return yoyPct > 0 ? "▲" : "▼";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function KpiCardSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 text-sm font-medium text-gray-400 dark:text-gray-600">{label}</div>
      <div className="mb-3 h-8 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}
