/**
 * features/sales/SalesPage.tsx
 *
 * Página de Ventas — Redesign V2.
 *
 * Estructura (consistente con ExecutivePage):
 *   TIER 1 (Command Center — above the fold):
 *     - Filtros in-page (DataFreshnessTag + ExecutiveFilters)
 *     - Grid 3 columnas: Hero Ventas + 2 mini-cards + Margen Bruto
 *   TIER 2 (Analytics — below fold):
 *     - Cards independientes: Marcas, Canal, Comportamiento, SKUs
 *
 * REGLA: Sin lógica de negocio. Solo layout + composición.
 */
import { useState, useEffect } from "react";
import { useSalesDashboard } from "./hooks/useSalesDashboard";
import { useSalesAnalytics } from "./hooks/useSalesAnalytics";
import { BrandsCard } from "./components/BrandsCard";
import { ChannelCard } from "./components/ChannelCard";
import { StoresTable } from "./components/StoresTable";
import { BehaviorCard } from "./components/BehaviorCard";
import { SkusCard } from "./components/SkusCard";
import { useFilters } from "@/context/FilterContext";
import { formatPYG, formatPYGSuffix, formatPct, formatChange } from "@/utils/format";
import { classifyMarginHealth } from "@/domain/kpis/calculations";
import { useMarginConfig } from "@/hooks/useConfig";
import { Card } from "@/components/ui/card/Card";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { ExecutiveFilters } from "@/features/executive/components/ExecutiveFilters";


// ─── Main component ──────────────────────────────────────────────────────────

export default function SalesPage() {
  const { worstStatus, getInfo } = useDataFreshness();
  const salesFreshness = worstStatus(["mv_ventas_diarias", "mv_ventas_mensual"]);
  const salesRefreshedAt = getInfo("mv_ventas_diarias")?.refreshedAt;
  const { filters } = useFilters();
  const marginConfig = useMarginConfig();
  const [enableSkus, setEnableSkus] = useState(true);
  const [enableBehavior, setEnableBehavior] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  // Limpiar selección de tienda cuando cambian los filtros globales
  useEffect(() => { setSelectedStore(null); }, [filters.brand, filters.channel, filters.store, filters.period, filters.year]);

  const {
    metrics,
    activeMonths,
    isLoading: dashLoading,
    error: dashError,
    lastDataDay,
    lastDataMonth,
  } = useSalesDashboard();

  const {
    brandBreakdown,
    channelMix,
    topSkus,
    dayOfWeek,
    storeBreakdown,
    storeBreakdownB2C,
    storeBreakdownB2B,
    salesWideRaw,
    dailyDetailRaw,
    activeMonths: analyticsActiveMonths,
    isDowLoading,
    isSkusLoading,
    isStoresLoading,
  } = useSalesAnalytics({ activeMonths, enableSkus, enableBehavior, selectedStoreOverride: selectedStore });

  if (dashLoading) return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      {/* Filtros + Data Freshness Tag */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton variant="text" width="120px" height="0.75rem" className="self-center sm:self-auto" />
        <Skeleton variant="text" width="100%" height="2rem" className="sm:w-[200px]" />
      </div>

      {/* Grid 4 columnas: Ventas + 2 mini stacked + Margen + AOV */}
      <div className="grid grid-cols-1 gap-4 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton variant="card" height="5.5rem" className="sm:h-[7rem]" />
        <div className="flex flex-col gap-2">
          <Skeleton variant="card" height="3rem" className="sm:h-[3.25rem]" />
          <Skeleton variant="card" height="3rem" className="sm:h-[3.25rem]" />
        </div>
        <Skeleton variant="card" height="5.5rem" className="sm:h-[7rem]" />
        <Skeleton variant="card" height="5.5rem" className="sm:h-[7rem]" />
      </div>

      {/* Marcas card */}
      <Skeleton variant="card" height="8rem" className="sm:h-[10rem]" />

      {/* Tiendas table */}
      <Skeleton variant="card" height="10rem" className="sm:h-[14rem]" />

      {/* Comportamiento + SKUs */}
      <div className="grid grid-cols-1 gap-4 sm:gap-3 lg:grid-cols-2">
        <Skeleton variant="card" height="10rem" className="sm:h-[12rem]" />
        <Skeleton variant="card" height="10rem" className="sm:h-[12rem]" />
      </div>
    </div>
  );

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

  const { real, budget, grossMarginPct, markdownPct, budgetAttainment, growthVsLY, lastYear, globalAOV } = metrics;
  const budgetDeviation = budgetAttainment - 100;
  const isBudgetPositive = budgetDeviation >= 0;
  const isGrowthPositive = growthVsLY >= 0;

  // Margin health: channel-aware thresholds
  const marginChannel = filters.channel === "b2b" ? "b2b" as const : filters.channel === "b2c" ? "b2c" as const : "total" as const;
  const marginHealth = classifyMarginHealth(grossMarginPct, marginChannel, marginConfig);
  const marginColorClass = marginHealth === "healthy"
    ? "text-success-600 dark:text-success-400"
    : marginHealth === "moderate"
    ? "text-warning-600 dark:text-warning-400"
    : "text-error-600 dark:text-error-400";
  const marginBarClass = marginHealth === "healthy"
    ? "bg-gradient-to-r from-success-400 to-success-500"
    : marginHealth === "moderate"
    ? "bg-gradient-to-r from-warning-400 to-warning-500"
    : "bg-gradient-to-r from-error-400 to-error-500";
  const marginBadgeClass = marginHealth === "healthy"
    ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
    : marginHealth === "moderate"
    ? "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500"
    : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500";
  const marginLabel = marginHealth === "healthy" ? "Saludable" : marginHealth === "moderate" ? "Moderado" : "Bajo";

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* ═══ TIER 1: COMMAND CENTER ═══════════════════════════════════════ */}

      {/* Filtros — consistente con Inicio */}
      <div className="exec-anim-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataFreshnessTag
            lastDataDay={lastDataDay}
            lastDataMonth={lastDataMonth}
            freshnessStatus={salesFreshness}
            refreshedAt={salesRefreshedAt}
          />
          <ExecutiveFilters />
        </div>
      </div>

      {/* Grid 4 columnas: Hero + Mini-cards + Margen + AOV */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        {/* Ventas Reales — hero card (like Inicio's Ventas Netas) */}
        <div className="exec-anim-2">
          <Card padding="lg" className="flex h-full flex-col">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Ventas Netas
            </p>
            <div className="mt-auto">
              <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                {formatPYGSuffix(real)}
              </p>
              {budget > 0 && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Presupuesto: {formatPYG(budget)}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Cumplimiento + Crecimiento — 2 mini-cards stacked (like Inicio) */}
        <div className="exec-anim-2 flex flex-col gap-2">
          <Card padding="sm" className="relative flex-1 flex flex-col px-4 py-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Cumplimiento Presupuesto
            </p>
            <p className={`mt-auto text-xl font-bold tabular-nums ${
              isBudgetPositive
                ? "text-success-600 dark:text-success-400"
                : "text-error-600 dark:text-error-400"
            }`}>
              {formatPct(budgetAttainment)}
            </p>
            <span className={`absolute right-4 bottom-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
              isBudgetPositive
                ? "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"
                : "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400"
            }`}>
              {formatChange(budgetDeviation)}
            </span>
          </Card>
          <Card padding="sm" className="relative flex-1 flex flex-col px-4 py-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Crecimiento vs Año Anterior
            </p>
            <p className={`mt-auto text-xl font-bold tabular-nums ${
              isGrowthPositive
                ? "text-success-600 dark:text-success-400"
                : "text-error-600 dark:text-error-400"
            }`}>
              {formatChange(growthVsLY)}
            </p>
            {lastYear > 0 && (
              <span className={`absolute right-4 bottom-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                isGrowthPositive
                  ? "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"
                  : "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400"
              }`}>
                {isGrowthPositive ? "▲" : "▼"} YoY
              </span>
            )}
          </Card>
        </div>

        {/* Margen Bruto + Markdown — card with visual indicators */}
        <div className="exec-anim-2">
          <Card padding="lg" className="flex h-full flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Margen Bruto
            </p>

            <div className="mt-auto flex flex-col items-center justify-center py-3">
              <p className={`text-3xl font-bold tabular-nums ${marginColorClass}`}>
                {formatPct(grossMarginPct)}
              </p>

              {/* Visual bar */}
              <div className="mt-3 w-full max-w-[180px]">
                <div className="relative h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${marginBarClass}`}
                    style={{ width: `${Math.min(grossMarginPct, 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-center">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${marginBadgeClass}`}>
                    {marginLabel}
                  </span>
                </div>
              </div>

              {/* Markdown dependency */}
              <div className="mt-3 w-full border-t border-gray-100 pt-3 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Dependencia Dcto</span>
                  <span className="text-sm font-bold tabular-nums text-gray-700 dark:text-gray-300">
                    {formatPct(markdownPct)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Ticket Promedio (AOV) — no disponible con filtro de marca */}
        <div className="exec-anim-2">
          <Card padding="lg" className="flex h-full flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 text-center">
              Ticket Promedio
            </p>
            <div className="flex-1 flex flex-col items-center justify-center">
              {filters.brand !== "total" ? (
                <>
                  <p className="text-sm font-medium text-gray-400 dark:text-gray-500">—</p>
                  <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
                    No disponible con filtro de marca
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
                    {globalAOV > 0 ? formatPYGSuffix(globalAOV) : "—"}
                  </p>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-1">
              Promedio por transacción
            </p>
          </Card>
        </div>
      </div>

      {/* ═══ TIER 2: ANALYTICS ════════════════════════════════════════════ */}

      {/* Marcas — solo visible cuando brand="total" */}
      {filters.brand === "total" && (
        <div className="exec-anim-3">
          <BrandsCard data={brandBreakdown} year={filters.year} />
        </div>
      )}

      {/* Tiendas (+ Zonas cuando canal=total) — full width */}
      {filters.channel === "total" ? (
        <div className="exec-anim-4">
          <StoresTable
            storeBreakdown={storeBreakdownB2C}
            storeBreakdownB2B={storeBreakdownB2B}
            isStoresLoading={isStoresLoading}
            channelMode="b2c"
            onSelectStore={setSelectedStore}
            onDeselectStore={() => setSelectedStore(null)}
            salesWideRaw={salesWideRaw}
            dailyDetailRaw={dailyDetailRaw}
            activeMonths={analyticsActiveMonths}
            brand={filters.brand}
          />
        </div>
      ) : (
        <div className="exec-anim-4">
          <StoresTable
            storeBreakdown={storeBreakdown}
            isStoresLoading={isStoresLoading}
            channelMode={filters.channel}
            onSelectStore={setSelectedStore}
            onDeselectStore={() => setSelectedStore(null)}
            salesWideRaw={salesWideRaw}
            dailyDetailRaw={dailyDetailRaw}
            activeMonths={analyticsActiveMonths}
            brand={filters.brand}
          />
        </div>
      )}

      {/* Comportamiento + Mix (izq) | Top SKUs (der) */}
      {(() => {
        const showChannelMix = filters.channel === "total" && !selectedStore;
        return (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              {showChannelMix && (
                <div className="exec-anim-4">
                  <ChannelCard
                    channelMix={channelMix}
                    storeBreakdown={storeBreakdown}
                    channelMode={filters.channel}
                    isStoresLoading={isStoresLoading}
                    salesWideRaw={salesWideRaw}
                    activeMonths={analyticsActiveMonths}
                    brand={filters.brand}
                  />
                </div>
              )}
              <div className="exec-anim-5">
                <BehaviorCard
                  data={dayOfWeek}
                  isLoading={isDowLoading}
                  onRequestLoad={() => setEnableBehavior(true)}
                  filteredStoreName={selectedStore}
                />
              </div>
            </div>
            <div className="exec-anim-6">
              <SkusCard
                data={topSkus}
                isLoading={isSkusLoading}
                onRequestLoad={() => setEnableSkus(true)}
                filteredStoreName={selectedStore}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
