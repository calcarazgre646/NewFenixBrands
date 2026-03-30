/**
 * features/depots/components/NoveltySection.tsx
 *
 * Sección dedicada de novedades/lanzamientos en la página de Depósitos.
 * Muestra resumen de distribución + tabla de productos nuevos con estado.
 */
import { useState } from "react";
import { formatNumber, formatPYGCompact } from "@/utils/format";
import type { NoveltyData, NoveltyDistributionStatus } from "@/domain/depots/types";
import DistributionStatusPill from "./DistributionStatusPill";

interface Props {
  novelty: NoveltyData;
}

const thCls =
  "px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap";

const BAR_COLORS: Record<NoveltyDistributionStatus, string> = {
  en_deposito:     "bg-gray-400 dark:bg-gray-500",
  en_distribucion: "bg-amber-400 dark:bg-amber-500",
  cargado:         "bg-emerald-500 dark:bg-emerald-400",
};

const BAR_LABELS: Record<NoveltyDistributionStatus, string> = {
  en_deposito: "En depósito",
  en_distribucion: "En distribución",
  cargado: "Cargado",
};

const PAGE_SIZE = 20;

export default function NoveltySection({ novelty }: Props) {
  const [page, setPage] = useState(0);

  if (novelty.totalSkus === 0) return null;

  const totalPages = Math.ceil(novelty.skus.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visibleSkus = novelty.skus.slice(start, start + PAGE_SIZE);

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white dark:border-violet-500/20 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="border-b border-violet-100 px-5 py-3 dark:border-violet-500/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-500/15">
              <svg className="h-3 w-3 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Novedades / Lanzamientos
            </span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <StatusChip>{novelty.totalSkus} SKUs</StatusChip>
            <StatusChip>{formatNumber(novelty.totalUnits)} uds.</StatusChip>
            <StatusChip>{formatPYGCompact(novelty.totalValue)}</StatusChip>
          </div>
        </div>

        {/* Distribution bar */}
        <div className="mt-3">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            {(["en_deposito", "en_distribucion", "cargado"] as const).map((status) => {
              const count = novelty.byStatus[status];
              if (count === 0) return null;
              const pct = (count / novelty.totalSkus) * 100;
              return (
                <div
                  key={status}
                  className={`${BAR_COLORS[status]} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {(["en_deposito", "en_distribucion", "cargado"] as const).map((status) => (
              <span key={status} className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                <span className={`inline-block h-2 w-2 rounded-full ${BAR_COLORS[status]}`} />
                {BAR_LABELS[status]}: <strong className="text-gray-700 dark:text-gray-300">{novelty.byStatus[status]}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className={`${thCls} text-left`}>Producto</th>
              <th className={`${thCls} text-left hidden sm:table-cell`}>Marca</th>
              <th className={`${thCls} text-right`}>Uds.</th>
              <th className={`${thCls} text-right hidden sm:table-cell`}>STOCK</th>
              <th className={`${thCls} text-right hidden sm:table-cell`}>RETAILS</th>
              <th className={`${thCls} text-right hidden md:table-cell`}>Tiendas</th>
              <th className={`${thCls} text-right hidden md:table-cell`}>Cobertura</th>
              <th className={`${thCls} text-left`}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {visibleSkus.map((row) => (
              <tr
                key={row.sku}
                className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2">
                  <span className="block truncate font-medium text-gray-800 dark:text-white">
                    {row.description}
                  </span>
                  <span className="block truncate text-[10px] text-gray-400 dark:text-gray-500">
                    {row.skuComercial || row.sku}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-gray-600 dark:text-gray-300">
                  {row.brand}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatNumber(row.totalUnits)}
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatNumber(row.stockUnits)}
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatNumber(row.retailsUnits)}
                </td>
                <td className="hidden md:table-cell px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {row.storeCount}/{row.totalDependentStores}
                </td>
                <td className="hidden md:table-cell px-3 py-2 text-right tabular-nums font-semibold text-gray-800 dark:text-white">
                  {row.coveragePct}%
                </td>
                <td className="px-3 py-2">
                  <DistributionStatusPill status={row.distributionStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5 dark:border-gray-700">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {start + 1}–{Math.min(start + PAGE_SIZE, novelty.skus.length)} de {novelty.skus.length}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400">
      {children}
    </span>
  );
}
