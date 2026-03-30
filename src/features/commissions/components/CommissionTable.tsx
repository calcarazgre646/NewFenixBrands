/**
 * features/commissions/components/CommissionTable.tsx
 *
 * Tabla paginada de comisiones por vendedor.
 */
import { useState } from "react";
import { formatPYGCompact } from "@/utils/format";
import { ROLE_LABELS, CHANNEL_LABELS } from "@/domain/commissions/scales";
import type { CommissionResult } from "@/domain/commissions/types";

interface Props {
  results: CommissionResult[];
}

const PAGE_SIZE = 15;
const thCls = "px-3 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap";

function CumplimientoBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 120 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
    : pct >= 100 ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400"
    : pct >= 80  ? "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
    : pct >= 70  ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
    : "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

export default function CommissionTable({ results }: Props) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visible = results.slice(start, start + PAGE_SIZE);

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
        No hay comisiones para este período y filtro
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Detalle por vendedor
        </span>
        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          {results.length} vendedores · Total: {formatPYGCompact(results.reduce((s, r) => s + r.comisionTotalGs, 0))}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className={`${thCls} text-left`}>Vendedor</th>
              <th className={`${thCls} text-left hidden sm:table-cell`}>Rol</th>
              <th className={`${thCls} text-left hidden md:table-cell`}>Canal</th>
              <th className={`${thCls} text-right`}>Meta</th>
              <th className={`${thCls} text-right`}>Real</th>
              <th className={`${thCls} text-right`}>Cumpl.</th>
              <th className={`${thCls} text-right hidden sm:table-cell`}>% / Fijo</th>
              <th className={`${thCls} text-right`}>Comisión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {visible.map((r) => (
              <tr
                key={`${r.vendedorCodigo}-${r.canal}`}
                className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2.5">
                  <span className="block font-medium text-gray-800 dark:text-white">
                    {r.vendedorNombre}
                  </span>
                  <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                    {r.sucursal ?? "—"}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-gray-600 dark:text-gray-300">
                  <span className="text-[11px]">{ROLE_LABELS[r.rolComision]}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 text-gray-600 dark:text-gray-300">
                  {CHANNEL_LABELS[r.canal] ?? r.canal}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {r.metaVentas > 0
                    ? formatPYGCompact(r.metaVentas)
                    : <span className="text-[10px] text-amber-500">Pendiente</span>
                  }
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatPYGCompact(r.ventaReal)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {r.metaVentas > 0
                    ? <CumplimientoBadge pct={r.cumplimientoVentasPct} />
                    : <span className="text-[10px] text-gray-400">—</span>
                  }
                </td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {r.metaVentas > 0
                    ? r.tipoComision === "fixed"
                      ? formatPYGCompact(r.comisionTotalGs)
                      : `${r.comisionVentasPct}%`
                    : <span className="text-[10px] text-gray-400">—</span>
                  }
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                  {r.metaVentas > 0
                    ? formatPYGCompact(r.comisionTotalGs)
                    : <span className="text-[10px] text-amber-500">Pendiente</span>
                  }
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
            {start + 1}–{Math.min(start + PAGE_SIZE, results.length)} de {results.length}
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
