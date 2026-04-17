/**
 * features/marketing/components/InventoryHealth.tsx
 *
 * Tab Inventario — datos de mv_stock_tienda desde perspectiva de marketing.
 * Stats + chart por marca + tablas stock bajo / sobrestock.
 */
import { useMemo } from "react";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { Spinner } from "@/components/ui/spinner/Spinner";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import type { InventoryHealthSummary, MarketingInventoryItem } from "@/queries/marketing.queries";

interface Props {
  summary: InventoryHealthSummary;
  isLoading: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("es-PY");
}

function fmtGs(n: number): string {
  return `₲ ${Math.round(n).toLocaleString("es-PY")}`;
}

const BRAND_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

export function InventoryHealth({ summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (summary.totalSkus === 0) {
    return <EmptyState title="Sin datos de inventario" description="No se encontraron registros en mv_stock_tienda." />;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total SKUs" value={fmt(summary.totalSkus)} sub="En stock" />
        <StatCard label="Unidades" value={fmt(summary.totalUnits)} sub="Totales" />
        <StatCard
          label="Stock Bajo"
          value={fmt(summary.lowStockCount)}
          sub="≤ 5 unidades"
          variant="negative"
        />
        <StatCard
          label="Sobrestock"
          value={fmt(summary.overstockCount)}
          sub="≥ 100 unidades"
          variant="accent-negative"
        />
      </div>

      {/* Chart por marca */}
      {summary.byBrand.length > 0 && <BrandChart byBrand={summary.byBrand} />}

      {/* Tablas lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ItemTable
          title="Ultimas Unidades"
          insight={`${fmt(summary.lowStockCount)} productos con menos de 5 unidades — oportunidad para campaña de urgencia`}
          items={summary.lowStockItems}
          showPrice
          accentColor="text-red-600 dark:text-red-400"
        />
        <ItemTable
          title="Oportunidad Liquidacion"
          insight={`${fmt(summary.overstockCount)} productos con sobrestock — candidatos para campaña de descuento`}
          items={summary.overstockItems}
          showValue
          accentColor="text-amber-600 dark:text-amber-400"
        />
      </div>
    </div>
  );
}

/* ── Brand bar chart ── */

function BrandChart({ byBrand }: { byBrand: InventoryHealthSummary["byBrand"] }) {
  const top = byBrand.slice(0, 10);

  const options: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", height: 300 },
      xaxis: { categories: top.map((b) => b.brand || "Sin marca") },
      colors: BRAND_COLORS,
      plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
      dataLabels: { enabled: true, formatter: (v: number) => fmt(v) },
      legend: { show: false },
      tooltip: {
        y: { formatter: (v: number) => fmt(v) + " unidades" },
      },
    }),
    [top],
  );

  const series = useMemo(
    () => [{ name: "Unidades", data: top.map((b) => b.units) }],
    [top],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
        Stock por Marca
      </h3>
      <ResponsiveChart options={options} series={series} type="bar" height={300} />
    </div>
  );
}

/* ── Items table ── */

interface ItemTableProps {
  title: string;
  insight: string;
  items: MarketingInventoryItem[];
  showPrice?: boolean;
  showValue?: boolean;
  accentColor: string;
}

function ItemTable({ title, insight, items, showPrice, showValue, accentColor }: ItemTableProps) {
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
              <th className="py-2 pr-2">Tienda</th>
              <th className="py-2 pr-2 text-right">Uds.</th>
              {showPrice && <th className="py-2 text-right">Precio</th>}
              {showValue && <th className="py-2 text-right">Valor</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={`${item.sku}-${item.store}-${i}`}
                className="border-b border-gray-100 dark:border-gray-700/50"
              >
                <td className="py-1.5 pr-2 font-mono text-[11px]">{item.sku}</td>
                <td className="py-1.5 pr-2 max-w-[160px] truncate" title={item.description}>
                  {item.description}
                </td>
                <td className="py-1.5 pr-2">{item.brand}</td>
                <td className="py-1.5 pr-2">{item.store}</td>
                <td className={`py-1.5 pr-2 text-right font-semibold tabular-nums ${accentColor}`}>
                  {fmt(item.units)}
                </td>
                {showPrice && (
                  <td className="py-1.5 text-right tabular-nums">{fmtGs(item.price)}</td>
                )}
                {showValue && (
                  <td className="py-1.5 text-right tabular-nums">{fmtGs(item.value)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
