/**
 * features/action-queue/components/LostOpportunityTab.tsx
 *
 * Pestaña "Oportunidad" del Centro de Acciones — déficit no cubierto monetizado.
 *
 * Pedido de Rodrigo (audio 17/03/2026):
 *   "Déficit = oportunidad, productos a fabricar/importar.
 *    Venta que perdiste por no tener producto, por compañía y por tienda."
 *
 * Reusa `gapUnits` del waterfall (la misma señal que alimenta "Planificación de Compra"),
 * pero monetizado y agregado en dos lentes ejecutivas:
 *   - Por compañía/marca: cuánto $ deja de capturar cada marca por falta de producto.
 *   - Por tienda: cuánto $ pierde cada tienda + desglose por marca.
 */
import { useMemo } from "react";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { formatPYGSuffix } from "@/utils/format";
import {
  buildOpportunityByBrand,
  buildOpportunityByStore,
  computeOpportunityTotals,
} from "@/domain/actionQueue/lostOpportunity";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";

// ─── Constants ───────────────────────────────────────────────────────────────

// Depots no son tiendas que pierdan venta al consumidor — se excluyen del análisis.
const DEPOT_STORES: ReadonlySet<string> = new Set(["RETAILS", "STOCK"]);

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  items: ActionItemFull[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LostOpportunityTab({ items }: Props) {
  const byBrand  = useMemo(() => buildOpportunityByBrand(items),                   [items]);
  const byStore  = useMemo(() => buildOpportunityByStore(items, DEPOT_STORES),     [items]);
  const totals   = useMemo(() => computeOpportunityTotals(items, DEPOT_STORES),    [items]);

  // ── Empty state ──
  if (totals.totalGapUnits === 0) {
    return (
      <div className="space-y-6">
        <div className="exec-anim-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Oportunidad Total" value="Gs. 0" />
          <StatCard label="Unidades Faltantes" value="0" />
          <StatCard label="Tiendas Afectadas" value="0" />
          <StatCard label="SKUs en Déficit" value="0" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No hay déficit detectado. El stock disponible cubre la demanda esperada en toda la red.
          </p>
        </div>
      </div>
    );
  }

  // Promedio por tienda — para contexto en la card principal
  const avgPerStore = totals.storeCount > 0 ? totals.totalLostRevenue / totals.storeCount : 0;

  return (
    <div className="space-y-6">
      {/* ═══ STATS ROW ═══ */}
      <div className="exec-anim-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Oportunidad Total"
          value={formatPYGSuffix(totals.totalLostRevenue)}
          sub="Venta perdida por falta de stock"
          variant="negative"
        />
        <StatCard
          label="Unidades Faltantes"
          value={`${totals.totalGapUnits.toLocaleString("es-PY")} u.`}
          sub={`En ${totals.skuCount} SKU${totals.skuCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Tiendas Afectadas"
          value={String(totals.storeCount)}
          sub={`Promedio ${formatPYGSuffix(avgPerStore)} por tienda`}
        />
        <StatCard
          label="Marcas con Déficit"
          value={String(totals.brandCount)}
        />
      </div>

      {/* ═══ POR COMPAÑIA / MARCA ═══ */}
      <section className="exec-anim-2 space-y-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Por compañía
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {byBrand.length} {byBrand.length === 1 ? "marca" : "marcas"}
          </span>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byBrand.map(b => {
            const sharePct = totals.totalLostRevenue > 0
              ? (b.lostRevenue / totals.totalLostRevenue) * 100
              : 0;
            return (
              <div
                key={b.brand}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {b.brand}
                  </h3>
                  <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                    {sharePct.toFixed(0)}% del total
                  </span>
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-error-600 dark:text-error-400">
                  {formatPYGSuffix(b.lostRevenue)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="tabular-nums">
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      {b.gapUnits.toLocaleString("es-PY")}
                    </span>{" "}u. faltantes
                  </span>
                  <span aria-hidden className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="tabular-nums">
                    {b.skuCount} SKU{b.skuCount === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="tabular-nums">
                    {b.storeCount} tienda{b.storeCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ POR TIENDA ═══ */}
      <section className="exec-anim-3 space-y-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Por tienda
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {byStore.length} {byStore.length === 1 ? "tienda" : "tiendas"}
          </span>
        </header>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                  <Th className="w-8 text-center">#</Th>
                  <Th>Tienda</Th>
                  <Th>Desglose por marca</Th>
                  <Th className="w-24 text-right">Unidades</Th>
                  <Th className="w-20 text-center">SKUs</Th>
                  <Th className="w-32 text-right">Oportunidad</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                {byStore.map((row, i) => (
                  <tr key={row.store} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
                    <td className="px-3 py-2.5 text-center text-[11px] tabular-nums text-gray-300 dark:text-gray-600">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900 dark:text-white">{row.store}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {row.brandsBreakdown.map(bb => (
                          <span
                            key={bb.brand}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            title={`${bb.gapUnits.toLocaleString("es-PY")} u. faltantes`}
                          >
                            <span className="font-medium">{bb.brand}</span>
                            <span className="tabular-nums text-error-600 dark:text-error-400">
                              {formatPYGSuffix(bb.lostRevenue)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-700 dark:text-gray-300">
                      {row.gapUnits.toLocaleString("es-PY")}
                    </td>
                    <td className="px-3 py-2.5 text-center text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                      {row.skuCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <span className="text-sm font-bold tabular-nums text-error-600 dark:text-error-400">
                        {formatPYGSuffix(row.lostRevenue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/60">
                  <td colSpan={3} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Total
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-300">
                    {totals.totalGapUnits.toLocaleString("es-PY")}
                  </td>
                  <td className="px-3 py-2.5 text-center text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">
                    {totals.skuCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span className="text-sm font-bold tabular-nums text-error-600 dark:text-error-400">
                      {formatPYGSuffix(totals.totalLostRevenue)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Para detalle a nivel SKU (qué importar/fabricar), ver pestaña{" "}
          <span className="font-medium text-gray-500 dark:text-gray-400">Planificación de Compra</span>.
        </p>
      </section>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 ${className ?? ""}`}>
      {children}
    </th>
  );
}
