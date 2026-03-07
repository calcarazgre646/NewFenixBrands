/**
 * features/executive/ExecutivePage.tsx
 *
 * Vista ejecutiva "Road to Annual Target".
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion de componentes.
 * Toda la data y calculos vienen de useExecutiveData.
 */
import { useMemo } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Link } from "react-router";
import { useExecutiveData } from "./hooks/useExecutiveData";
import { MonthlyPerformanceTable } from "./components/MonthlyPerformanceTable";
import { MONTH_SHORT } from "@/domain/period/helpers";

// ─── Format helpers ──────────────────────────────────────────────────────────

function fmtFull(value: number): string {
  return `${Math.round(value).toLocaleString("es-PY")} Gs.`;
}

function fmtShort(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)} T`;
  if (value >= 1_000_000_000)     return `${(value / 1_000_000_000).toFixed(1)} MM`;
  if (value >= 1_000_000)         return `${(value / 1_000_000).toFixed(1)} M`;
  if (value >= 1_000)             return `${(value / 1_000).toFixed(0)} K`;
  return String(Math.round(value));
}

// ─── Chart config ────────────────────────────────────────────────────────────

function buildChartOptions(
  labels: string[],
  currentMonthLabel: string,
  isPartialMonth: boolean,
): ApexOptions {
  return {
    chart: {
      type: "area",
      fontFamily: "Outfit, sans-serif",
      background: "transparent",
      toolbar: { show: false },
      animations: { enabled: false },
    },
    colors: ["#3B82F6", "#10B981", "#F59E0B"],
    annotations: isPartialMonth
      ? {
          xaxis: [
            {
              x: currentMonthLabel,
              borderColor: "#F59E0B",
              borderWidth: 2,
              strokeDashArray: 4,
              label: {
                text: "Hoy",
                style: {
                  background: "#FEF3C7",
                  color: "#92400E",
                  fontSize: "11px",
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
      width: [2.5, 2, 2],
      dashArray: [0, 0, 6],
    },
    fill: {
      type: "gradient",
      gradient: { type: "vertical", opacityFrom: [0.25, 0.18, 0], opacityTo: 0 },
    },
    markers: { size: 0, hover: { size: 4 } },
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "12px", colors: "#6B7280" } },
    },
    yaxis: {
      labels: {
        style: { fontSize: "11px", colors: ["#6B7280"] },
        formatter: (val: number) => fmtShort(val),
      },
    },
    grid: {
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      borderColor: "#F3F4F6",
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
      fontWeight: 500,
      markers: { size: 6 },
      itemMargin: { horizontal: 12 },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (val: number | null) => (val != null ? fmtFull(val) : "\u2014") },
    },
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label, description }: { label: string; description?: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 text-xs text-gray-400 dark:text-gray-600">{description}</span>
        )}
      </div>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? positive
            ? "border-success-200 bg-success-50 dark:border-success-500/20 dark:bg-success-500/10"
            : "border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p
        className={`break-words text-xl font-bold leading-tight ${
          highlight
            ? positive
              ? "text-success-700 dark:text-success-400"
              : "text-error-700 dark:text-error-400"
            : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-500"
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-semibold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400">
          Ver &rarr;
        </span>
      </div>
      <p className="mb-1 text-sm font-bold text-gray-900 dark:text-white">{title}</p>
      <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">{description}</p>
    </Link>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function ExecutiveSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-12 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="h-80 rounded-2xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ExecutivePage() {
  const {
    metrics,
    chartPoints,
    monthlyRows,
    calendarMonth,
    isPartialMonth,
    isLoading,
    error,
    getRowsForView,
  } = useExecutiveData();

  // Chart series
  const { labels, series } = useMemo(() => {
    const lbl = chartPoints.map((p) => p.label);
    const s = [
      { name: "Acumulado Real",       data: chartPoints.map((p) => p.cumReal) },
      { name: "Pronostico Acumulado", data: chartPoints.map((p) => p.cumForecast) },
      { name: "Objetivo Acumulado",   data: chartPoints.map((p) => p.cumTarget) },
    ];
    return { labels: lbl, series: s };
  }, [chartPoints]);

  const currentMonthLabel = MONTH_SHORT[calendarMonth] ?? "";

  if (isLoading) return <ExecutiveSkeleton />;

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
    gapToTarget,
    requiredMonthlyRunRate,
    realProgressPct,
    forecastProgressPct,
    monthsRemaining,
    linearPaceGap,
  } = metrics;

  const isAheadOfForecast = gapToTarget <= 0;
  const isAheadOfPace = linearPaceGap <= 0;
  const realBarPct = Math.min(realProgressPct, 100);
  const forecastBarPct = Math.max(0, Math.min(forecastProgressPct, 100) - realBarPct);

  return (
    <div className="space-y-10 p-4 sm:p-6">
      {/* ── SECTION 1: Executive Summary ─────────────────────────────────── */}
      <section className="space-y-6">
        <SectionHeader label="Resumen Ejecutivo" description="Progreso anual al objetivo" />

        {/* Header Banner */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Executive Dashboard
            </p>
            <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">
              Road to {fmtFull(annualTarget)}
            </h1>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:self-auto ${
              isAheadOfPace
                ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                : "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isAheadOfPace ? "bg-success-500" : "bg-warning-500"
              }`}
            />
            {isAheadOfPace
              ? `Adelantado al ritmo lineal por ${fmtFull(Math.abs(linearPaceGap))}`
              : `Atrasado al ritmo lineal por ${fmtFull(Math.abs(linearPaceGap))}`}
          </span>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Objetivo Anual" value={fmtFull(annualTarget)} />
          <MetricCard
            label="Pronostico Cierre"
            value={fmtFull(forecastYearEnd)}
            sub={`YTD: ${fmtFull(ytd)}`}
          />
          <MetricCard
            label="Brecha vs Objetivo"
            value={
              isAheadOfForecast
                ? `Superado por ${fmtFull(Math.abs(gapToTarget))}`
                : `Brecha: ${fmtFull(gapToTarget)}`
            }
            highlight
            positive={isAheadOfForecast}
          />
          <MetricCard
            label="Run-Rate Mensual Requerido"
            value={fmtFull(requiredMonthlyRunRate)}
            sub={`Para alcanzar el objetivo en ${monthsRemaining} meses`}
          />
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 rounded-2xl border border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="relative h-4 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-emerald-400/60 transition-all duration-700 dark:bg-emerald-500/50"
              style={{ width: `${realBarPct + forecastBarPct}%` }}
            />
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${realBarPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-500 align-middle" />
              Progreso Real:{" "}
              <strong className="text-gray-700 dark:text-gray-300">
                {realProgressPct.toFixed(1)}%
              </strong>
              <span className="ml-1 text-gray-400">({fmtFull(ytd)})</span>
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 align-middle" />
              Pronostico:{" "}
              <strong className="text-gray-700 dark:text-gray-300">
                {forecastProgressPct.toFixed(1)}%
              </strong>
              <span className="ml-1 text-gray-400">| {monthsRemaining} meses restantes</span>
            </span>
          </div>
        </div>

        {/* Cumulative Chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          {isPartialMonth && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-warning-600 dark:text-warning-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warning-500" />
              El acumulado real incluye datos parciales del mes en curso
            </p>
          )}
          <Chart
            options={buildChartOptions(labels, currentMonthLabel, isPartialMonth)}
            series={series}
            type="area"
            height={320}
          />
        </div>

        {/* Monthly Performance Table */}
        {monthlyRows.length > 0 && (
          <MonthlyPerformanceTable rows={monthlyRows} getRowsForView={getRowsForView} />
        )}
      </section>

      {/* ── SECTION 2: Quick Access ──────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          label="Modulos Comerciales"
          description="Navega a cada herramienta del POD"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickLink
            to="/ventas"
            icon="&#128200;"
            title="Analisis de Ventas"
            description="Performance vs presupuesto y ano anterior. Margen por marca, mix de canal y top SKUs."
          />
          <QuickLink
            to="/acciones"
            icon="&#128230;"
            title="Cola de Acciones"
            description="Movimientos de stock priorizados por impacto financiero. B2C y B2B, por tienda y SKU."
          />
          <QuickLink
            to="/logistica"
            icon="&#128674;"
            title="Logistica / ETAs"
            description="Pedidos de importacion con fechas estimadas de arribo y alertas de stock por marca."
          />
        </div>
      </section>
    </div>
  );
}
