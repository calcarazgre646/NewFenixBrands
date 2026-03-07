/**
 * features/sales/SalesPage.tsx
 *
 * Pagina de analisis de ventas.
 *
 * Secciones:
 *   1. Performance banner (vs presupuesto, vs ano anterior)
 *   2. 4 metric cards (Ventas, Cumplimiento, Crecimiento YoY, Margen Bruto)
 *   3. Analytics panel con tabs (Marcas, Canal, Top SKUs)
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useSalesDashboard } from "./hooks/useSalesDashboard";
import { useSalesAnalytics } from "./hooks/useSalesAnalytics";
import { SalesAnalyticsPanel } from "./components/SalesAnalyticsPanel";
import { useFilters } from "@/context/FilterContext";

// ─── Format helpers ──────────────────────────────────────────────────────────

function fmtGs(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} MM Gs.`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(0)} M Gs.`;
  return `${Math.round(value).toLocaleString("es-PY")} Gs.`;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  badge,
  badgePositive,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  badgePositive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="break-words text-xl font-bold leading-tight text-gray-900 dark:text-white">
          {value}
        </p>
        {badge && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              badgePositive
                ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                : "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400"
            }`}
          >
            {badgePositive ? "▲" : "▼"} {badge}
          </span>
        )}
      </div>
      {sub && <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function SalesSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-80 rounded-2xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SalesPage() {
  const { filters } = useFilters();
  const {
    metrics,
    periodLabel,
    activeMonths,
    isLoading: dashLoading,
    error: dashError,
  } = useSalesDashboard();

  const {
    brandBreakdown,
    channelMix,
    topSkus,
    dayOfWeek,
    storeBreakdown,
    isLoading: analyticsLoading,
    isDowLoading,
    isStoresLoading,
  } = useSalesAnalytics(activeMonths);

  if (dashLoading) return <SalesSkeleton />;

  if (dashError || !metrics) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-error-700 dark:text-error-400">
            {dashError ?? "No se pudieron cargar los datos de ventas."}
          </p>
        </div>
      </div>
    );
  }

  const { real, budget, grossMarginPct, budgetAttainment, growthVsLY, lastYear, isPartialMonth } = metrics;
  const budgetDeviation = budgetAttainment - 100;
  const isBudgetPositive = budgetDeviation >= 0;
  const isGrowthPositive = growthVsLY >= 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Analisis de Ventas
        </h1>
        {periodLabel && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {periodLabel}
          </p>
        )}
      </div>

      {/* Performance banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
        {/* Budget pill */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            isBudgetPositive
              ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400"
              : "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isBudgetPositive ? "bg-success-500" : "bg-error-500"}`} />
          {fmtChange(budgetDeviation)} vs presupuesto
        </span>

        {/* YoY pill */}
        {lastYear > 0 && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isGrowthPositive
                ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                : "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400"
            }`}
          >
          <span className={`h-1.5 w-1.5 rounded-full ${isGrowthPositive ? "bg-success-500" : "bg-error-500"}`} />
            {fmtChange(growthVsLY)} vs ano anterior
          </span>
        )}

        {/* Period label */}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          {periodLabel}
          {isPartialMonth && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warning-500" />
          )}
        </span>
      </div>

      {/* Partial month warning */}
      {isPartialMonth && (
        <div className="flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-xs text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warning-500" />
          Los datos incluyen el mes en curso con informacion parcial
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Ventas Reales"
          value={fmtGs(real)}
          sub={budget > 0 ? `Presupuesto: ${fmtGs(budget)}` : undefined}
          badge={budget > 0 && real > budget ? fmtGs(real - budget) : undefined}
          badgePositive={real >= budget}
        />
        <MetricCard
          label="Cumplimiento Presupuesto"
          value={fmtPct(budgetAttainment)}
          sub={isBudgetPositive ? "Sobre objetivo" : "Bajo objetivo"}
          badge={fmtChange(budgetDeviation)}
          badgePositive={isBudgetPositive}
        />
        <MetricCard
          label="Crecimiento vs Ano Ant."
          value={fmtChange(growthVsLY)}
          sub={lastYear > 0 ? `Ano anterior: ${fmtGs(lastYear)}` : "Sin datos ano anterior"}
          badge={lastYear > 0 ? fmtChange(growthVsLY) : undefined}
          badgePositive={isGrowthPositive}
        />
        <MetricCard
          label="Margen Bruto"
          value={fmtPct(grossMarginPct)}
          sub="Sobre ventas netas"
          badge={grossMarginPct >= 30 ? "Saludable" : "Bajo"}
          badgePositive={grossMarginPct >= 30}
        />
      </div>

      {/* Analytics Panel */}
      <SalesAnalyticsPanel
        brandBreakdown={brandBreakdown}
        channelMix={channelMix}
        topSkus={topSkus}
        dayOfWeek={dayOfWeek}
        storeBreakdown={storeBreakdown}
        isLoading={analyticsLoading}
        isDowLoading={isDowLoading}
        isStoresLoading={isStoresLoading}
        showBrandsTab={filters.brand === "total"}
        channelMode={filters.channel}
      />
    </div>
  );
}
