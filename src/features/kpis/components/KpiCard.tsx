/**
 * features/kpis/components/KpiCard.tsx
 *
 * Tarjeta de KPI — diseño ejecutivo.
 * Indicador visual de tendencia + valor prominente + comparación anual.
 */
import { formatKpiValue, formatChange } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import { MiniSparkline } from "@/features/sales/components/salesAnalytics.shared";
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
  sparkline,
}: KpiCardProps) {
  if (isLoading) return <KpiCardSkeleton label={title} />;

  const hasYoY = !error && yoyPct !== null;
  const yoyColor = getYoyColor(yoyPct, positiveDirection);
  const yoyBg = getYoyBg(yoyPct, positiveDirection);
  const yoyIcon = yoyPct !== null && yoyPct !== 0 ? (yoyPct > 0 ? "↑" : "↓") : null;

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Title */}
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </p>

      {/* Value + Sparkline */}
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          {error ? (
            <span className="text-2xl font-bold text-gray-300 dark:text-gray-600" title={error}>
              —
            </span>
          ) : (
            <span className="whitespace-nowrap text-xl font-bold tabular-nums text-gray-900 dark:text-white lg:text-2xl">
              {formatKpiValue(value, unit)}
            </span>
          )}
        </div>
        {!error && sparkline && sparkline.length >= 2 && (
          <MiniSparkline data={sparkline} color={getSparkColor(yoyPct, positiveDirection)} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 dark:border-gray-700">
        {hasYoY ? (
          <span className="flex items-center gap-2">
            <span className={`inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${yoyBg} ${yoyColor}`}>
              {yoyIcon && <span>{yoyIcon}</span>}
              {formatChange(yoyPct)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">vs año ant.</span>
          </span>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {error ? "Sin datos" : "Sin comparación"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Locked KPI Card ─────────────────────────────────────────────────────────

export function LockedKpiCard({ name, definition, pstLabel, pstClass }: {
  name: string;
  definition: string;
  pstLabel: string;
  pstClass: string;
}) {
  return (
    <div className="relative select-none rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      {/* Content — dimmed */}
      <div className="opacity-40">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 line-clamp-1">
          {name}
        </p>
        <p className="mb-4 text-3xl font-bold text-gray-300 dark:text-gray-600">--</p>
        <p className="text-[11px] text-gray-300 dark:text-gray-600 line-clamp-1">{definition}</p>
      </div>

      {/* Center overlay — lock + badge */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
          <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pstClass}`}>
          {pstLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSparkColor(yoyPct: number | null, dir: "up" | "down"): string {
  if (yoyPct === null || yoyPct === 0) return "#465FFF"; // brand blue
  const isGood = dir === "up" ? yoyPct > 0 : yoyPct < 0;
  return isGood ? "#12b76a" : "#f04438";
}

function getYoyColor(yoyPct: number | null, dir: "up" | "down"): string {
  if (yoyPct === null || yoyPct === 0) return "text-gray-500 dark:text-gray-400";
  const isGood = dir === "up" ? yoyPct > 0 : yoyPct < 0;
  return isGood ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400";
}

function getYoyBg(yoyPct: number | null, dir: "up" | "down"): string {
  if (yoyPct === null || yoyPct === 0) return "bg-gray-100 dark:bg-gray-700";
  const isGood = dir === "up" ? yoyPct > 0 : yoyPct < 0;
  return isGood ? "bg-green-50 dark:bg-green-500/10" : "bg-red-50 dark:bg-red-500/10";
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function KpiCardSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <Skeleton variant="text" height="2.25rem" width="10rem" className="mb-4" />
      <div className="border-t border-gray-100 pt-2.5 dark:border-gray-700">
        <Skeleton variant="text" height="0.75rem" width="5rem" />
      </div>
    </div>
  );
}
