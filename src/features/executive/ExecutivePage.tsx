/**
 * features/executive/ExecutivePage.tsx
 *
 * Vista ejecutiva "Road to Annual Target" — V2 Redesign.
 *
 * Estructura:
 *   TIER 1 (Command Center — above the fold):
 *     - Context Filters (marca/canal/periodo)
 *     - Monthly Sales Bar (barras mensuales + línea presupuesto)
 *     - 4 Scorecards (2 accionables + 2 contextuales)
 *     - Insight Bar (diagnóstico automático por marca)
 *   TIER 2 (Temporal Analysis — below fold):
 *     - Chart + Tabla side-by-side
 *     - Quick Links compactos
 *
 * REGLA: Sin lógica de negocio. Solo layout + composición.
 * Toda la data viene de useExecutiveData.
 */
import { useMemo } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { useExecutiveData } from "./hooks/useExecutiveData";
import { InsightBar } from "./components/InsightBar";
import { ExecutiveFilters } from "./components/ExecutiveFilters";
import { MonthlyPerformanceTable } from "./components/MonthlyPerformanceTable";
import { MONTH_SHORT, MONTH_FULL } from "@/domain/period/helpers";
import { formatPYGSuffix, formatCompact, formatChange } from "@/utils/format";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { Card } from "@/components/ui/card/Card";
import { DataFreshnessTag } from "./components/DataFreshnessTag";


// ─── Chart config ────────────────────────────────────────────────────────────

function buildChartOptions(
  labels: string[],
  currentMonthLabel: string,
  isPartialMonth: boolean,
  isDaily = false,
  lastDataDay: number | null = null,
): ApexOptions {
  if (isDaily) {
    // Mismo estilo que el chart anual pero con eje X de días
    return {
      chart: {
        type: "area",
        fontFamily: "Outfit, sans-serif",
        background: "transparent",
        toolbar: { show: false },
        animations: { enabled: true, dynamicAnimation: { enabled: true, speed: 400 } },
      },
      colors: ["#465fff", "#F59E0B", "#94A3B8"],
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: [2.5, 1.5, 1.5], dashArray: [0, 8, 5] },
      fill: {
        type: "gradient",
        gradient: { type: "vertical", opacityFrom: [0.2, 0, 0], opacityTo: 0 },
      },
      markers: { size: [3, 0, 0], hover: { size: 5 }, strokeWidth: 2, strokeColors: "#fff" },
      xaxis: {
        categories: labels,
        axisBorder: { show: false },
        axisTicks: { show: false },
        title: { text: "Día", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
        labels: {
          style: { fontSize: "10px", colors: "#98a2b3", fontWeight: 500 },
          formatter: (val: string) => { const d = Number(val); return d === 1 || d % 5 === 0 ? val : ""; },
        },
      },
      yaxis: {
        title: { text: "Gs.", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
        labels: {
          style: { fontSize: "10px", colors: ["#98a2b3"] },
          formatter: (val: number) => formatCompact(val),
        },
      },
      grid: { xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } }, borderColor: "#f2f4f7" },
      legend: {
        show: true, position: "top", horizontalAlign: "left",
        fontSize: "12px", fontWeight: 500,
        markers: { size: 5, shape: "circle" }, itemMargin: { horizontal: 12 },
      },
      tooltip: {
        shared: true, intersect: false,
        y: { formatter: (val: number | null) => (val != null ? formatPYGSuffix(val) : "\u2014") },
      },
    };
  }

  return {
    chart: {
      type: "area",
      fontFamily: "Outfit, sans-serif",
      background: "transparent",
      toolbar: { show: false },
      animations: { enabled: true, dynamicAnimation: { enabled: true, speed: 400 } },
    },
    colors: ["#465fff", "#F59E0B", "#94A3B8"],
    annotations: isPartialMonth
      ? {
          xaxis: [
            {
              x: currentMonthLabel,
              borderColor: "#F59E0B",
              borderWidth: 1.5,
              strokeDashArray: 3,
              label: {
                text: lastDataDay ? `${lastDataDay} ${currentMonthLabel}` : "Hoy",
                style: {
                  background: "#FEF0C7",
                  color: "#92400E",
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: { left: 6, right: 6, top: 2, bottom: 2 },
                },
                position: "top",
              },
            },
          ],
        }
      : {},
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth",
      width: [2.5, 1.5, 1.5],
      dashArray: [0, 8, 5],
    },
    fill: {
      type: "gradient",
      gradient: { type: "vertical", opacityFrom: [0.2, 0, 0], opacityTo: 0 },
    },
    markers: { size: [3, 0, 0], hover: { size: 5 }, strokeWidth: 2, strokeColors: "#fff" },
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      title: { text: "Mes", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
      labels: { style: { fontSize: "11px", colors: "#98a2b3", fontWeight: 500 } },
    },
    yaxis: {
      title: { text: "Gs.", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
      labels: {
        style: { fontSize: "10px", colors: ["#98a2b3"] },
        formatter: (val: number) => formatCompact(val),
      },
    },
    grid: {
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      borderColor: "#f2f4f7",
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
      fontWeight: 500,
      markers: { size: 5, shape: "circle" },
      itemMargin: { horizontal: 12 },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (val: number | null) => (val != null ? formatPYGSuffix(val) : "\u2014") },
    },
  };
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ExecutivePage() {

  const {
    metrics,
    chartPoints,
    dailyChartPoints,
    monthlyRows,
    insights,
    channelInsights,
    periodLabel,
    calendarMonth,
    isPartialMonth,
    isYtdView,
    isLoading,
    isInventoryLoading,
    error,
    lastDataDay,
  } = useExecutiveData();

  // Series del chart principal — cambia según período
  const { labels, series } = useMemo(() => {
    if (dailyChartPoints) {
      return {
        labels: dailyChartPoints.map((p) => p.label),
        series: [
          { name: "Real",          data: dailyChartPoints.map((p) => p.real) },
          { name: "Presupuesto",   data: dailyChartPoints.map((p) => p.budgetDaily) },
          { name: "Año Anterior",  data: dailyChartPoints.map((p) => p.priorYear) },
        ],
      };
    }
    return {
      labels: chartPoints.map((p) => p.label),
      series: [
        { name: "Acumulado Real",       data: chartPoints.map((p) => p.cumReal) },
        { name: "Objetivo Acumulado",   data: chartPoints.map((p) => p.cumTarget) },
        { name: "Año Anterior",         data: chartPoints.map((p) => p.cumPriorYear) },
      ],
    };
  }, [chartPoints, dailyChartPoints]);


  const currentMonthLabel = MONTH_SHORT[calendarMonth] ?? "";

  // Descripción exacta del período con fechas — ANTES de early returns (regla de hooks)
  // periodLabel viene de resolvePeriod y ya es correcto para cada filtro:
  //   ytd → "Ene–Mar 2026", lastClosedMonth → "Febrero 2026", currentMonth → "Marzo 2026 ⚠"
  // Solo refinamos con día exacto cuando el período incluye el mes en curso con datos parciales.
  const periodDateRange = useMemo(() => {
    const yr = new Date().getFullYear();
    if (isYtdView && lastDataDay) {
      return `1 Ene – ${lastDataDay} ${MONTH_SHORT[calendarMonth]} ${yr}`;
    }
    if (isYtdView) {
      return `1 Ene – ${new Date().getDate()} ${MONTH_SHORT[calendarMonth]} ${yr}`;
    }
    // currentMonth y lastClosedMonth: usar periodLabel de resolvePeriod
    return periodLabel;
  }, [isYtdView, lastDataDay, calendarMonth, periodLabel]);

  if (isLoading) return <PageSkeleton />;

  if (error || !metrics) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-error-700 dark:text-error-400">
            {error ?? "No se pudieron cargar los datos ejecutivos."}
          </p>
        </div>
      </div>
    );
  }

  const {
    annualTarget,
    ytd,
    forecastYearEnd,
    yoyPct,
    yoyDelta,
    gmroi,
    inventoryTurnover,
  } = metrics;

  const forecastBeatsAnnual = forecastYearEnd >= annualTarget;
  const isMonthView = !isYtdView;
  const isClosedMonth = isMonthView && forecastYearEnd === ytd;
  const metaLabel = isMonthView ? "Meta del Mes" : "Meta Anual";
  const viewMonth = isClosedMonth ? calendarMonth - 1 : calendarMonth;
  const viewMonthName = MONTH_FULL[viewMonth] ?? "";

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* ═══ TIER 1: COMMAND CENTER ═══════════════════════════════════════ */}

      {/* Context Filters (in-page, hierarchical) */}
      <div className="exec-anim-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataFreshnessTag
            lastDataDay={lastDataDay}
            calendarMonth={calendarMonth}
            isPartialMonth={isPartialMonth}
          />
          <ExecutiveFilters />
        </div>
      </div>

      {/* Top 3-column grid: 2 metric cards + 1 tall card */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr]">
        {/* Ventas Netas */}
        <div className="exec-anim-2">
          <Card padding="lg" className="flex h-full flex-col">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Ventas Netas
            </p>
            <div className="mt-auto">
              <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                {formatPYGSuffix(ytd)}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {periodDateRange}
              </p>
            </div>
          </Card>
        </div>

        {/* vs Año Anterior */}
        <div className="exec-anim-2">
          <Card padding="lg" className="relative flex h-full flex-col">
            <span className={`absolute right-4 top-5 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
              yoyPct >= 0
                ? "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"
                : "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400"
            }`}>
              {formatChange(yoyPct)}
            </span>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {isMonthView ? `vs. ${viewMonthName} ${new Date().getFullYear() - 1}` : `vs Mismo Período ${new Date().getFullYear() - 1}`}
            </p>
            <div className="mt-auto">
              <p className={`mt-1 text-xl font-bold tabular-nums ${
                yoyDelta >= 0
                  ? "text-success-600 dark:text-success-400"
                  : "text-error-600 dark:text-error-400"
              }`}>
                {yoyDelta >= 0 ? "+" : "−"}{formatPYGSuffix(Math.abs(yoyDelta))}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {periodDateRange}
              </p>
            </div>
          </Card>
        </div>

        {/* Cumplimiento vs Objetivo — gauge card (tall, spans 2 rows on lg) */}
        <div className="exec-anim-2 sm:col-span-2 lg:col-span-1 lg:row-span-2">
          <div className="h-full rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-white/[0.03]">
            <div className="h-full px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                {metaLabel}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {periodDateRange}
              </p>
              {(() => {
                const ytdPct = annualTarget > 0 ? (ytd / annualTarget) * 100 : 0;
                const ytdPctRounded = Math.round(ytdPct * 10) / 10;
                const remaining = annualTarget - ytd;
                return (
                  <>
                    <div className="relative mt-30">
                      <Chart
                        key={`gauge-${ytdPctRounded}`}
                        options={{
                          colors: [forecastBeatsAnnual ? "#039855" : "#465FFF"],
                          chart: {
                            fontFamily: "Outfit, sans-serif",
                            type: "radialBar",
                            sparkline: { enabled: true },
                          },
                          plotOptions: {
                            radialBar: {
                              startAngle: -85,
                              endAngle: 85,
                              hollow: { size: "80%" },
                              track: {
                                background: "#E4E7EC",
                                strokeWidth: "100%",
                                margin: 5,
                              },
                              dataLabels: {
                                name: { show: false },
                                value: {
                                  fontSize: "36px",
                                  fontWeight: "600",
                                  offsetY: -40,
                                  color: undefined,
                                  formatter: () => `${ytdPctRounded.toFixed(1)}%`,
                                },
                              },
                            },
                          },
                          fill: { type: "solid" },
                          stroke: { lineCap: "round" },
                          labels: ["Cumplimiento"],
                        }}
                        series={[Math.min(ytdPctRounded, 100)]}
                        type="radialBar"
                        height={400}
                      />
                      <span
                        className={`absolute left-1/2 top-full -translate-x-1/2 -translate-y-[95%] rounded-full px-3 py-1 text-xs font-medium ${
                          forecastBeatsAnnual
                            ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
                            : "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                        }`}
                      >
                        {forecastBeatsAnnual
                          ? (isClosedMonth ? "Meta superada" : "Proyección supera meta")
                          : `Faltan ₲ ${formatCompact(remaining)}`}
                      </span>
                    </div>
                    <p className="mx-auto mt-28 max-w-[280px] text-center text-sm text-gray-500 dark:text-gray-400">
                      {formatPYGSuffix(ytd)} vendidos de una {isMonthView ? "meta mensual" : "meta anual"} de {formatPYGSuffix(annualTarget)}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Chart principal (inside grid, spans first 2 columns) */}
        <div className="exec-anim-3 sm:col-span-2 lg:col-span-2">
          <Card padding="lg">
            <div role="img" aria-label={dailyChartPoints ? "Gráfico diario del mes" : "Gráfico acumulado anual"}>
              <Chart
                key={dailyChartPoints ? "daily" : "cumulative"}
                options={buildChartOptions(labels, currentMonthLabel, isPartialMonth, !!dailyChartPoints, lastDataDay)}
                series={series}
                type="area"
                height={280}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Insight Bar */}
      {insights.length > 0 && (
        <div className="exec-anim-8">
          <InsightBar insights={insights} altInsights={channelInsights} />
        </div>
      )}

      {/* ═══ TIER 2: Scorecards + Full-width Table ═══════════════════════ */}

      {/* 4 KPI Scorecards — orden definido por cliente */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* 1. Pronóstico */}
        <div className="exec-anim-4">
          <StatCard
            label={isClosedMonth ? "Cierre del Mes" : isMonthView ? "Pronóstico Mes" : "Pronóstico Anual"}
            value={formatPYGSuffix(forecastYearEnd)}
            sub={forecastBeatsAnnual
              ? `+${((forecastYearEnd / annualTarget - 1) * 100).toFixed(1)}% sobre ${isMonthView ? "meta mensual" : "meta anual"}`
              : `${((forecastYearEnd / annualTarget - 1) * 100).toFixed(1)}% bajo ${isMonthView ? "meta mensual" : "meta anual"}`
            }
            variant={forecastBeatsAnnual ? "accent-positive" : "accent-negative"}
          />
        </div>
        {/* 2. Ritmo vs Presupuesto — siempre visible */}
        <div className="exec-anim-5">
          {(() => {
            const ritmoPct = annualTarget > 0 ? (forecastYearEnd / annualTarget) * 100 : 0;
            const onTrack = ritmoPct >= 100;
            return (
              <StatCard
                label="Ritmo vs Presupuesto"
                value={annualTarget > 0 ? `${ritmoPct.toFixed(1)}%` : "\u2014"}
                sub={onTrack
                  ? `+${(ritmoPct - 100).toFixed(1)}pp sobre ${isMonthView ? "meta mensual" : "meta anual"}`
                  : `${(ritmoPct - 100).toFixed(1)}pp bajo ${isMonthView ? "meta mensual" : "meta anual"}`
                }
                variant={onTrack ? "accent-positive" : "accent-negative"}
              />
            );
          })()}
        </div>
        {/* 3. Rotación Inventario */}
        <div className="exec-anim-6">
          {isInventoryLoading ? (
            <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Rotación Inventario</p>
              <div className="mt-3 h-6 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            </div>
          ) : (
            <StatCard
              label="Rotación Inventario"
              value={`${inventoryTurnover.toFixed(1)}x`}
              sub={inventoryTurnover >= 4 ? "Rotación saludable" : inventoryTurnover >= 2 ? "Rotación moderada" : "Rotación baja"}
              variant={inventoryTurnover >= 4 ? "accent-positive" : undefined}
            />
          )}
        </div>
        {/* 4. GMROI */}
        <div className="exec-anim-7">
          {isInventoryLoading ? (
            <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">GMROI</p>
              <div className="mt-3 h-6 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            </div>
          ) : (
            <StatCard
              label="GMROI"
              value={`${gmroi.toFixed(2)}`}
              sub={gmroi >= 2 ? "Retorno saludable" : gmroi >= 1 ? "Retorno moderado" : "Retorno bajo"}
              variant={gmroi >= 2 ? "accent-positive" : gmroi < 1 ? "accent-negative" : undefined}
            />
          )}
        </div>
      </div>

      {/* Tabla de performance mensual — full width */}
      {monthlyRows.length > 0 && (
        <MonthlyPerformanceTable rows={monthlyRows} highlightMonth={isMonthView ? viewMonth : null} lastDataDay={lastDataDay} calendarMonth={calendarMonth} isPartialMonth={isPartialMonth} />
      )}

    </div>
  );
}
