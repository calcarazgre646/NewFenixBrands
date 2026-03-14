/**
 * features/depots/components/SkuLeadersTable.tsx
 *
 * Tabla consolidada de SKU lideres por valor (cross-node).
 * Patrón de diseño: MonthlyPerformanceTable (ExecutivePage).
 */
import { formatNumber, formatPYGCompact, formatWeeks } from "@/utils/format";
import { Card } from "@/components/ui/card/Card";
import type { DepotSkuRow } from "@/domain/depots/types";

interface Props {
  rows: DepotSkuRow[];
}

const thCls = "px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap";

export default function SkuLeadersTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          SKU lideres por valor
        </span>
        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          Top consolidado de STOCK, RETAILS y red retail
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className={`${thCls} text-left`}>Nodo</th>
              <th className={`${thCls} text-left`}>Producto</th>
              <th className={`${thCls} text-left hidden sm:table-cell`}>Talle</th>
              <th className={`${thCls} text-left hidden md:table-cell`}>Marca</th>
              <th className={`${thCls} text-right`}>Uds.</th>
              <th className={`${thCls} text-right hidden sm:table-cell`}>Valor</th>
              <th className={`${thCls} text-right hidden md:table-cell`}>Vta/sem</th>
              <th className={`${thCls} text-right`}>WOI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {rows.map((row, i) => (
              <tr
                key={`${row.store}-${row.sku}-${row.talle}-${i}`}
                className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">
                  <span className="block truncate">{row.store}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="block truncate font-medium text-gray-800 dark:text-white">
                    {row.skuComercial || row.sku}
                  </span>
                  <span className="block truncate text-[10px] text-gray-400 dark:text-gray-500">
                    {row.description}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-gray-600 dark:text-gray-300">
                  {row.talle}
                </td>
                <td className="hidden md:table-cell px-3 py-2 text-gray-600 dark:text-gray-300">
                  {row.brand}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatNumber(row.units)}
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatPYGCompact(row.value)}
                </td>
                <td className="hidden md:table-cell px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatNumber(row.weeklySales)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-800 dark:text-white">
                  {formatWeeks(row.weeksOnHand)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
