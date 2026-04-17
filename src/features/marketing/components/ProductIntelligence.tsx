/**
 * features/marketing/components/ProductIntelligence.tsx
 *
 * Tab Productos — cruza ventas con catálogo para inteligencia de marketing.
 * Stats + tablas best/slow sellers + chart por tipo de artículo.
 */
import { useMemo } from "react";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { Spinner } from "@/components/ui/spinner/Spinner";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import type { PimSummary, ProductPerformance } from "@/queries/marketing.queries";

interface Props {
  data: PimSummary;
  isLoading: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("es-PY");
}

function fmtGs(n: number): string {
  return `₲ ${Math.round(n).toLocaleString("es-PY")}`;
}

const TYPE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
  "#06B6D4", "#D946EF", "#FB923C", "#22D3EE", "#A3E635",
];

export function ProductIntelligence({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (data.topSellers.length === 0 && data.totalProducts === 0) {
    return <EmptyState title="Sin datos de productos" description="No se encontraron datos de ventas o catálogo." />;
  }

  const skusSold = data.topSellers.length + data.slowMovers.length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Productos Activos" value={fmt(data.totalProducts)} sub="En catálogo" />
        <StatCard label="SKUs Vendidos" value={fmt(skusSold > 0 ? skusSold : data.topSellers.length)} sub="Este año" variant="neutral" />
        <StatCard label="Tipos" value={fmt(data.byType.length)} sub="Categorías distintas" variant="neutral" />
      </div>

      {/* Tablas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProductTable
          title="Best Sellers"
          insight="Productos estrella — considerar campañas de refuerzo"
          items={data.topSellers}
          accentColor="text-green-600 dark:text-green-400"
        />
        <ProductTable
          title="Slow Movers"
          insight="Productos que necesitan impulso — candidatos para promocion"
          items={data.slowMovers}
          accentColor="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Chart por tipo */}
      {data.byType.length > 0 && <TypeChart byType={data.byType} />}
    </div>
  );
}

/* ── Type bar chart ── */

function TypeChart({ byType }: { byType: PimSummary["byType"] }) {
  const top = byType.slice(0, 15);

  const options: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", height: 350 },
      xaxis: { categories: top.map((t) => t.type) },
      colors: TYPE_COLORS,
      plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
      dataLabels: { enabled: true, formatter: (v: number) => fmt(v) },
      legend: { show: false },
      tooltip: {
        y: { formatter: (v: number) => fmt(v) + " productos" },
      },
    }),
    [top],
  );

  const series = useMemo(
    () => [{ name: "Productos", data: top.map((t) => t.count) }],
    [top],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
        Por Tipo de Articulo
      </h3>
      <ResponsiveChart options={options} series={series} type="bar" height={350} />
    </div>
  );
}

/* ── Product table ── */

interface ProductTableProps {
  title: string;
  insight: string;
  items: ProductPerformance[];
  accentColor: string;
}

function ProductTable({ title, insight, items, accentColor }: ProductTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
        <p className="text-xs text-gray-400">Sin datos</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-[11px] text-gray-400 mb-3">{insight}</p>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white dark:bg-gray-800">
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
              <th className="py-2 pr-2">SKU</th>
              <th className="py-2 pr-2">Descripcion</th>
              <th className="py-2 pr-2">Marca</th>
              <th className="py-2 pr-2 text-right">Venta Neta</th>
              <th className="py-2 pr-2 text-right">Uds.</th>
              <th className="py-2 text-right">Peso %</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={`${item.sku}-${i}`}
                className="border-b border-gray-100 dark:border-gray-700/50"
              >
                <td className="py-1.5 pr-2 font-mono text-[11px]">{item.sku}</td>
                <td className="py-1.5 pr-2 max-w-[160px] truncate" title={item.description}>
                  {item.description}
                </td>
                <td className="py-1.5 pr-2">{item.brand}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{fmtGs(item.neto)}</td>
                <td className={`py-1.5 pr-2 text-right font-semibold tabular-nums ${accentColor}`}>
                  {fmt(item.units)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-brand-500 font-medium">
                  {item.weightPct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
