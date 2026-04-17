/**
 * features/marketing/components/CommercialInsights.tsx
 *
 * 3 mini-cards de inteligencia comercial para el tab Resumen.
 * Cruza datos de ITR (inventario) y PIM (productos).
 */
import type { InventoryHealthSummary, PimSummary } from "@/queries/marketing.queries";

interface Props {
  inventory: InventoryHealthSummary;
  products: PimSummary;
  onNavigate: (tab: string) => void;
}

function fmt(n: number): string {
  return n.toLocaleString("es-PY");
}

export function CommercialInsights({ inventory, products, onNavigate }: Props) {
  const topSeller = products.topSellers[0];
  const hasData = inventory.totalSkus > 0 || products.topSellers.length > 0;

  if (!hasData) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Inteligencia Comercial
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Stock critico */}
        <button
          type="button"
          onClick={() => onNavigate("inventario")}
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-left transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:hover:bg-red-500/20"
        >
          <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {fmt(inventory.lowStockCount)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            productos con stock critico
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            ≤ 5 unidades — ver en Inventario →
          </p>
        </button>

        {/* Sobrestock */}
        <button
          type="button"
          onClick={() => onNavigate("inventario")}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left transition-colors hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
        >
          <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {fmt(inventory.overstockCount)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            productos en sobrestock
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            ≥ 100 unidades — ver en Inventario →
          </p>
        </button>

        {/* Top seller */}
        <button
          type="button"
          onClick={() => onNavigate("productos")}
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-left transition-colors hover:bg-green-100 dark:border-green-500/20 dark:bg-green-500/10 dark:hover:bg-green-500/20"
        >
          {topSeller ? (
            <>
              <p className="text-sm font-bold text-green-700 dark:text-green-400 truncate" title={topSeller.description}>
                {topSeller.description}
              </p>
              <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400 mt-0.5">
                {topSeller.weightPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                del total de ventas — ver en Productos →
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-400 mt-1">Sin datos de ventas</p>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
