/**
 * features/projections/components/ProjectionChart.tsx
 *
 * Gráfico día×día acumulado del mes:
 *   - Real (sólido, hasta hoy)
 *   - Proyectado (punteado, futuro a partir de hoy)
 *   - Meta lineal (referencia, opcional)
 */
import { useMemo } from "react";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import { formatPYGCompact } from "@/utils/format";
import type { DailyProjectionPoint } from "@/domain/projections/types";

interface Props {
  series: DailyProjectionPoint[];
  height?: number;
}

export default function ProjectionChart({ series, height = 280 }: Props) {
  const { categories, realData, projData, metaData, hasMeta } = useMemo(() => {
    const cats = series.map(p => p.label);
    // Real: el acumulado real hasta hoy. null para días futuros.
    const real = series.map(p => (p.ventaAcumReal != null ? Math.round(p.ventaAcumReal) : null));
    // Proyectado: la curva completa (real hasta hoy + proyección lineal después).
    // Para que la línea conecte, dejamos los días pasados con el mismo valor que real.
    const proj = series.map(p => Math.round(p.ventaAcumProyectada));
    const meta = series.map(p => (p.ventaAcumMeta != null ? Math.round(p.ventaAcumMeta) : null));
    const has = series.some(p => p.ventaAcumMeta != null);
    return { categories: cats, realData: real, projData: proj, metaData: meta, hasMeta: has };
  }, [series]);

  const todayIndex = series.findIndex(p => p.isToday);

  const seriesData: ApexAxisChartSeries = useMemo(() => {
    const out: ApexAxisChartSeries = [
      {
        name: "Real",
        type: "area",
        data: realData as number[],
      },
      {
        name: "Proyección",
        type: "line",
        data: projData,
      },
    ];
    if (hasMeta) {
      out.push({
        name: "Meta lineal",
        type: "line",
        data: metaData as number[],
      });
    }
    return out;
  }, [realData, projData, metaData, hasMeta]);

  const options: ApexCharts.ApexOptions = useMemo(() => ({
    chart: {
      type: "line",
      height,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
    },
    stroke: {
      curve: "smooth",
      width: [3, 2.5, 2],
      dashArray: [0, 6, 4],
    },
    fill: {
      type: ["gradient", "solid", "solid"],
      gradient: {
        shadeIntensity: 0.6,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    colors: ["#3B82F6", "#10B981", "#94A3B8"],
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: { style: { fontSize: "10px" } },
      axisTicks: { show: false },
      tickAmount: Math.min(10, categories.length),
    },
    yaxis: {
      labels: {
        style: { fontSize: "10px" },
        formatter: (v: number) => formatPYGCompact(v),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "11px",
      markers: { size: 6 },
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 3,
    },
    tooltip: {
      shared: true,
      y: { formatter: (v: number) => (v != null ? formatPYGCompact(v) : "—") },
    },
    annotations: todayIndex >= 0 ? {
      xaxis: [{
        x: categories[todayIndex],
        borderColor: "#3B82F6",
        strokeDashArray: 4,
        label: {
          text: "Hoy",
          style: { color: "#fff", background: "#3B82F6", fontSize: "10px" },
          orientation: "horizontal",
        },
      }],
    } : undefined,
  }), [categories, height, todayIndex]);

  return (
    <ResponsiveChart options={options} series={seriesData} type="line" height={height} />
  );
}
