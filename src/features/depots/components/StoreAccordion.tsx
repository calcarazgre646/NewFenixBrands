/**
 * features/depots/components/StoreAccordion.tsx
 *
 * Accordion expandible por tienda — header simplificado, tabla responsive.
 * Header: nombre + risk badge + WOI grande. Detalle secundario sutil.
 * SKU table: sin min-width, columnas ocultas en mobile, limit visible rows.
 */
import { useState } from "react";
import { formatNumber, formatPYGCompact, formatWeeks } from "@/utils/format";

import type { StoreNode } from "@/domain/depots/types";
import RiskBadge from "./RiskBadge";
import MiniTable from "./MiniTable";

interface Props {
  store: StoreNode;
  defaultOpen?: boolean;
}

const SKU_VISIBLE_LIMIT = 15;

export default function StoreAccordion({ store, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAllSkus, setShowAllSkus] = useState(false);

  const visibleSkus = showAllSkus
    ? store.skuRows
    : store.skuRows.slice(0, SKU_VISIBLE_LIMIT);
  const hasMore = store.skuRows.length > SKU_VISIBLE_LIMIT;

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-white/[0.03]">
      {/* Toggle header — compact */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] sm:px-6"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                {store.label}
              </h3>
              {store.cluster && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  store.cluster === "A" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                  : store.cluster === "OUT" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}>
                  {store.cluster === "A" ? "Premium" : store.cluster === "OUT" ? "Outlet" : "Standard"}
                </span>
              )}
              <RiskBadge risk={store.risk} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              {formatNumber(store.units)} uds. · {formatNumber(store.skuCount)} SKU · dem. sem. {formatNumber(store.weeklyDemand)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <span className="block text-lg font-bold tabular-nums leading-none text-gray-900 dark:text-white">
              {formatWeeks(store.weeksOnHand)}
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              WOI
            </span>
          </div>
          <svg
            className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable body */}
      {isOpen && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 pb-4 dark:border-gray-700 dark:bg-white/[0.01] sm:px-6">
          {/* Brand + Category split — compact */}
          {(store.topBrands.length > 0 || store.topCategories.length > 0) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {store.topBrands.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                  <MiniTable
                    title="Marcas"
                    headers={["Marca", "Uds.", "Valor", "WOI"]}
                    rows={store.topBrands.map(r => [
                      r.label,
                      formatNumber(r.units),
                      formatPYGCompact(r.value),
                      formatWeeks(r.woi),
                    ])}
                  />
                </div>
              )}
              {store.topCategories.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                  <MiniTable
                    title="Categorias"
                    headers={["Categoria", "Uds.", "Valor", "WOI"]}
                    rows={store.topCategories.map(r => [
                      r.label,
                      formatNumber(r.units),
                      formatPYGCompact(r.value),
                      formatWeeks(r.woi),
                    ])}
                  />
                </div>
              )}
            </div>
          )}

          {/* SKU detail table */}
          {store.skuRows.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-700">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Detalle SKU
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Producto
                      </th>
                      <th className="hidden sm:table-cell px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Talle
                      </th>
                      <th className="hidden md:table-cell px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Marca
                      </th>
                      <th className="hidden lg:table-cell px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Categoria
                      </th>
                      <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Uds.
                      </th>
                      <th className="hidden sm:table-cell px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Vta/sem
                      </th>
                      <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        WOI
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {visibleSkus.map((row, i) => (
                      <tr
                        key={`${row.sku}-${row.talle}-${i}`}
                        className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                      >
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
                        <td className="hidden lg:table-cell px-3 py-2 text-gray-600 dark:text-gray-300">
                          {row.categoria}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                          {formatNumber(row.units)}
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
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
              {hasMore && !showAllSkus && (
                <button
                  onClick={() => setShowAllSkus(true)}
                  className="w-full border-t border-gray-100 py-2.5 text-[12px] font-medium text-brand-500 transition-colors hover:bg-gray-50/70 dark:border-gray-700 dark:hover:bg-white/[0.02]"
                >
                  Ver {store.skuRows.length - SKU_VISIBLE_LIMIT} mas
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {store.skuRows.length === 0 && store.units === 0 && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
              Sin inventario en esta tienda
            </div>
          )}
        </div>
      )}
    </article>
  );
}
