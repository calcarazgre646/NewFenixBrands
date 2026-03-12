/**
 * features/sales/components/BehaviorCard.tsx
 *
 * Day-of-week behavior bar chart with best-day highlight.
 */
import { useMemo, useState, useEffect } from "react";
import type { ApexOptions } from "apexcharts";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import type { DayOfWeekStat } from "../hooks/useSalesAnalytics";
import { formatPYGShort } from "@/utils/format";
import { Card } from "@/components/ui/card/Card";
import { SectionLabel, LazyLoadPrompt } from "./salesAnalytics.shared";

export function BehaviorCard({
  data,
  isLoading,
  onRequestLoad,
  filteredStoreName,
}: {
  data: DayOfWeekStat[];
  isLoading: boolean;
  onRequestLoad: () => void;
  filteredStoreName?: string | null;
}) {
  const bestDay = data.find((d) => d.isBest);
  const hasData = data.some((d) => d.totalNeto > 0);

  const chartOptions: ApexOptions = useMemo(() => ({
    colors: data.map((d) => (d.isBest ? "#465FFF" : "#E4E7EC")),
    chart: { fontFamily: "Outfit, sans-serif", type: "bar", toolbar: { show: false }, animations: { enabled: true, dynamicAnimation: { speed: 400 } } },
    plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: "50%", borderRadiusApplication: "end" } },
    dataLabels: { enabled: false },
    legend: { show: false },
    states: { hover: { filter: { type: "darken", value: 0.9 } } },
    xaxis: {
      categories: data.map((d) => d.dayShort),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontFamily: "Outfit", fontSize: "11px", colors: "#98a2b3", fontWeight: 500 } },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => formatPYGShort(val),
        style: { fontFamily: "Outfit", fontSize: "10px", colors: ["#98a2b3"] },
      },
    },
    grid: { yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } }, borderColor: "#f2f4f7" },
    tooltip: { y: { formatter: (val: number) => formatPYGShort(val) } },
  }), [data]);

  // Lazy load prompt
  if (!hasData && !isLoading) {
    return (
      <Card padding="lg" className="flex h-full flex-col">
        <SectionLabel>Comportamiento Semanal</SectionLabel>
        <div className="mt-auto">
          <LazyLoadPrompt
            label="Cargar distribución por día"
            onClick={onRequestLoad}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>Comportamiento Semanal</SectionLabel>
        {bestDay && !isLoading && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
            &#9733; Mejor día: {bestDay.dayName}
          </span>
        )}
      </div>

      {isLoading ? (
        <BehaviorLoadingFeed />
      ) : (
        <>
          <ResponsiveChart
            options={chartOptions}
            series={[{ name: "Ventas", data: data.map((d) => Math.round(d.totalNeto)) }]}
            type="bar"
            height={220}
          />
          {(bestDay || filteredStoreName) && (
            <div className="mt-auto flex flex-wrap items-center gap-6 border-t border-gray-100 pt-3 dark:border-gray-700">
              {bestDay && (
                <>
                  <div className="text-xs">
                    <span className="text-gray-400 dark:text-gray-500">Promedio {bestDay.dayName}: </span>
                    <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatPYGShort(bestDay.avgNeto)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-400 dark:text-gray-500">Transacciones: </span>
                    <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{bestDay.txCount.toLocaleString("es-PY")}</span>
                  </div>
                </>
              )}
              {filteredStoreName && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.22-.53l4.72-4.72M2.46 15l4.72-4.72a.75.75 0 00.22-.53V2.25" />
                  </svg>
                  {filteredStoreName}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Transparent loading feed ────────────────────────────────────────────────

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const BAR_HEIGHTS = [55, 80, 65, 90, 75, 45, 35];

const BEHAVIOR_MESSAGES = [
  "Agrupando transacciones por día…",
  "Calculando promedios diarios…",
  "Identificando mejor día de la semana…",
];

function BehaviorLoadingFeed() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev < BEHAVIOR_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[320px] flex-1 flex-col" role="status" aria-label="Cargando comportamiento">
      {/* Ghost bar chart */}
      <div className="flex flex-1 items-end gap-2 px-2 pt-2">
        {DAYS.map((day, i) => (
          <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t bg-gray-100 dark:bg-gray-700/60"
              style={{
                height: BAR_HEIGHTS[i],
                opacity: 0.4,
                animation: `aq-fade-in 0.4s ease-out ${i * 80}ms both`,
              }}
            />
            <span className="text-[11px] font-medium text-gray-300 dark:text-gray-600">{day}</span>
          </div>
        ))}
      </div>

      {/* Status message */}
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-700">
        <svg className="h-3.5 w-3.5 text-brand-400" style={{ animation: "aq-spin-slow 1s linear infinite" }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span
          className="font-mono text-[11px] text-gray-400 dark:text-gray-500"
          style={{ animation: "aq-fade-in 0.3s ease-out both" }}
          key={msgIdx}
        >
          {BEHAVIOR_MESSAGES[msgIdx]}
        </span>
      </div>
    </div>
  );
}
