/**
 * features/projections/components/ProjectionTable.tsx
 *
 * Tabla paginada de proyección por vendedor.
 * Columnas: Vendedor, Canal/Rol, Venta hoy, Ritmo/día, Proyección, Cumpl. proy., Comisión proy.
 */
import { useState } from "react";
import { formatPYGCompact } from "@/utils/format";
import { ROLE_LABELS, CHANNEL_LABELS } from "@/domain/commissions/scales";
import type { SellerProjection } from "@/domain/projections/types";

interface Props {
  results: SellerProjection[];
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
      {pct.toFixed(2)}%
    </span>
  );
}

export default function ProjectionTable({ results }: Props) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visible = results.slice(start, start + PAGE_SIZE);

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
        Sin datos para este período y filtro
      </div>
    );
  }

  const totalProyComm = results.reduce((s, r) => s + (r.comisionProyectadaGs ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Detalle por vendedor
        </span>
        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          {results.length} vendedores · Comisión proyectada total: {formatPYGCompact(totalProyComm)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className={`${thCls} text-left`}>Vendedor</th>
              <th className={`${thCls} text-left hidden md:table-cell`}>Rol / Canal</th>
              <th className={`${thCls} text-right`}>Venta hoy</th>
              <th className={`${thCls} text-right hidden sm:table-cell`}>Ritmo/día</th>
              <th className={`${thCls} text-right`}>Proyección</th>
              <th className={`${thCls} text-right hidden sm:table-cell`}>Meta</th>
              <th className={`${thCls} text-right`}>Cumpl. proy.</th>
              <th className={`${thCls} text-right`}>Comisión proy.</th>
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
                    {r.sucursalCodigo ?? "—"}
                  </span>
                  {r.diasTranscurridos === 0 && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                      Mes futuro
                    </span>
                  )}
                  {r.isMonthClosed && r.ventaActual === 0 && (
                    <span className="inline-flex items-center rounded-full bg-gray-50 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-500/10 dark:text-gray-400">
                      Sin ventas
                    </span>
                  )}
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 text-gray-600 dark:text-gray-300">
                  <span className="block text-[11px]">{ROLE_LABELS[r.rolComision]}</span>
                  <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                    {CHANNEL_LABELS[r.canal] ?? r.canal}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatPYGCompact(r.ventaActual)}
                </td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                  {r.ritmoDiario > 0 ? formatPYGCompact(r.ritmoDiario) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-800 dark:text-white">
                  {formatPYGCompact(r.ventaProyectada)}
                  {!r.isMonthClosed && r.ritmoDiario > 0 && (
                    <span className="block text-[9px] text-gray-400 dark:text-gray-500">
                      {r.diasRestantes}d restantes
                    </span>
                  )}
                </td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {r.metaVentas != null && r.metaVentas > 0
                    ? formatPYGCompact(r.metaVentas)
                    : <span className="text-[10px] text-amber-500">Pendiente</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {r.cumplimientoProyectadoPct != null
                    ? <CumplimientoBadge pct={r.cumplimientoProyectadoPct} />
                    : <span className="text-[10px] text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                  {r.comisionProyectadaGs != null
                    ? formatPYGCompact(r.comisionProyectadaGs)
                    : <span className="text-[10px] text-amber-500">Pendiente</span>}
                  {r.comisionProyectadaPct != null && r.comisionProyectadaPct > 0 && (
                    <span className="block text-[9px] text-gray-400 dark:text-gray-500">
                      {r.comisionProyectadaPct.toFixed(2)}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
