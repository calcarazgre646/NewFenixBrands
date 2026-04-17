/**
 * features/marketing/components/MarketingCharts.tsx
 *
 * Gráficos KPI para el dashboard de marketing.
 * Tier distribution (donut) + channel breakdown (bar).
 */
import { useMemo } from "react";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import type { MarketingMetrics, EtlStats } from "@/domain/marketing/types";

interface Props {
  metrics: MarketingMetrics;
  etlStats: EtlStats;
}

const ACTIVE_TIER_COLORS = ["#F59E0B", "#10B981", "#3B82F6", "#EF4444"];
const ACTIVE_TIER_LABELS = ["VIP", "Frecuente", "Ocasional", "En Riesgo"];

export function MarketingCharts({ metrics, etlStats }: Props) {
  const b = etlStats.tierBreakdown;

  // Show active tiers in the donut (exclude inactive — it would crush everything)
  const activeTierData = useMemo(
    () => [b.vip, b.frequent, b.occasional, b.at_risk],
    [b.vip, b.frequent, b.occasional, b.at_risk],
  );

  const activeTotal = activeTierData.reduce((s, v) => s + v, 0);
  const hasActiveTiers = activeTotal > 0;

  const tierOptions: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: { type: "donut", height: 280 },
      labels: ACTIVE_TIER_LABELS,
      colors: ACTIVE_TIER_COLORS,
      legend: { position: "bottom", fontSize: "11px" },
      dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(1)}%` },
      plotOptions: {
        pie: {
          donut: {
            size: "60%",
            labels: {
              show: true,
              total: {
                show: true,
                label: "Con Compras",
                fontSize: "12px",
                formatter: () => activeTotal.toLocaleString("es-PY"),
              },
            },
          },
        },
      },
    }),
    [activeTotal],
  );

  const channelOptions: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", height: 280 },
      xaxis: { categories: ["Email", "WhatsApp", "SMS"] },
      colors: ["#3B82F6", "#10B981", "#8B5CF6"],
      plotOptions: { bar: { horizontal: true, borderRadius: 6 } },
      dataLabels: { enabled: true },
    }),
    [],
  );

  const channelSeries = useMemo(
    () => [
      {
        name: "Alcanzables",
        data: [metrics.reachableEmail, metrics.reachableWhatsapp, 0],
      },
    ],
    [metrics],
  );

  if (!hasActiveTiers && metrics.totalCustomers === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {hasActiveTiers && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Distribución por Tier
          </h3>
          <ResponsiveChart options={tierOptions} series={activeTierData} type="donut" height={280} />
          {b.inactive > 0 && (
            <p className="mt-2 text-center text-[11px] text-gray-400">
              + {b.inactive.toLocaleString("es-PY")} inactivos (sin compras {new Date().getFullYear()})
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Alcance por Canal
        </h3>
        <ResponsiveChart options={channelOptions} series={channelSeries} type="bar" height={280} />
      </div>
    </div>
  );
}
