/**
 * features/action-queue/components/PurchasePlanningTab.tsx
 *
 * Pestaña "Planificación de Compra" del Centro de Acciones.
 *
 * Vista completa a nivel SKU de la demanda insatisfecha (gap).
 * Stats propios + filtros por Marca y Tipo + tabla paginada.
 *
 * Rodrigo: "la planificación de nuevo producto a nivel: SKU, Tipo de Producto, Marca"
 */
import { useState, useMemo } from "react";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { formatPYGSuffix } from "@/utils/format";
import { buildPurchasePlan, summarizeByBrand, computeGapTotals } from "@/domain/actionQueue/purchasePlanning";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  items: ActionItemFull[];
  avgDOI: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PurchasePlanningTab({ items, avgDOI }: Props) {
  const [page, setPage] = useState(0);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [lineaFilter, setLineaFilter] = useState<string | null>(null);

  // All SKU-level rows
  const allRows = useMemo(() => buildPurchasePlan(items), [items]);
  const brandSummaries = useMemo(() => summarizeByBrand(allRows), [allRows]);
  const allTotals = useMemo(() => computeGapTotals(allRows), [allRows]);

  // Unique lineas for filter
  const uniqueLineas = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) set.add(r.linea);
    return Array.from(set).sort();
  }, [allRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (brandFilter) rows = rows.filter(r => r.brand === brandFilter);
    if (lineaFilter) rows = rows.filter(r => r.linea === lineaFilter);
    return rows;
  }, [allRows, brandFilter, lineaFilter]);

  const filteredTotals = useMemo(() => computeGapTotals(filteredRows), [filteredRows]);
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const isFiltered = brandFilter !== null || lineaFilter !== null;
  const displayTotals = isFiltered ? filteredTotals : allTotals;

  const handleBrandFilter = (brand: string | null) => { setBrandFilter(brand); setPage(0); };
  const handleLineaFilter = (linea: string | null) => { setLineaFilter(linea); setPage(0); };

  // ── Empty state ──
  if (allRows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="exec-anim-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Gap Total" value="0 u." />
          <StatCard label="SKUs con Gap" value="0" />
          <StatCard label="DOI Promedio" value={`${avgDOI.toFixed(0)} días`} />
          <StatCard label="Impacto Potencial" value="Gs. 0" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No hay demanda insatisfecha. Todo el stock necesario puede cubrirse con inventario existente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ STATS ROW ═══ */}
      <div className="exec-anim-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Gap Total"
          value={`${displayTotals.totalGapUnits.toLocaleString("es-PY")} u.`}
          sub={isFiltered ? `de ${allTotals.totalGapUnits.toLocaleString("es-PY")} total` : "Producto a comprar"}
          variant={displayTotals.totalGapUnits > 0 ? "negative" : "neutral"}
        />
        <StatCard
          label="SKUs con Gap"
          value={String(filteredRows.length)}
          sub={isFiltered ? `de ${allRows.length} total` : undefined}
        />
        <StatCard
          label="DOI Promedio"
          value={`${avgDOI.toFixed(0)} días`}
          variant={avgDOI === 0 ? "neutral" : avgDOI < 30 ? "negative" : avgDOI < 60 ? "accent-negative" : "neutral"}
        />
        <StatCard
          label="Impacto Potencial"
          value={formatPYGSuffix(displayTotals.totalRevenue)}
          sub="Si se cubre el gap"
        />
      </div>

      {/* ═══ BRAND SUMMARY PILLS ═══ */}
      <div className="exec-anim-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Por marca
        </span>
        {brandSummaries.map(bs => (
          <span
            key={bs.brand}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              brandFilter === bs.brand
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {bs.brand}
            <span className={`font-bold tabular-nums ${brandFilter === bs.brand ? "text-white" : "text-error-600 dark:text-error-400"}`}>
              {bs.totalGapUnits.toLocaleString("es-PY")}
            </span>
            u.
            <span className={`text-[10px] tabular-nums ${brandFilter === bs.brand ? "text-white/70" : "text-gray-400 dark:text-gray-500"}`}>
              {formatPYGSuffix(bs.totalRevenue)}
            </span>
          </span>
        ))}
      </div>

      {/* ═══ FILTERS BAR ═══ */}
      <div className="exec-anim-2 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
        {/* Brand filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Marca
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <FilterBtn active={brandFilter === null} onClick={() => handleBrandFilter(null)}>Todas</FilterBtn>
            {brandSummaries.map(bs => (
              <FilterBtn key={bs.brand} active={brandFilter === bs.brand} onClick={() => handleBrandFilter(bs.brand)}>
                {bs.brand}
              </FilterBtn>
            ))}
          </div>
        </div>

        {/* Linea filter */}
        {uniqueLineas.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Tipo
            </span>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <FilterBtn active={lineaFilter === null} onClick={() => handleLineaFilter(null)}>Todos</FilterBtn>
              {uniqueLineas.map(l => (
                <FilterBtn key={l} active={lineaFilter === l} onClick={() => handleLineaFilter(l)}>{l}</FilterBtn>
              ))}
            </div>
          </div>
        )}

        <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">
          {filteredRows.length} {filteredRows.length === 1 ? "SKU" : "SKUs"}
          {isFiltered && ` de ${allRows.length}`}
        </span>
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="exec-anim-3 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                <Th className="w-8 text-center">#</Th>
                <Th>Producto</Th>
                <Th className="w-14 text-center">Talle</Th>
                <Th className="w-20">Marca</Th>
                <Th className="w-24">Tipo</Th>
                <Th className="w-20 text-right">Gap</Th>
                <Th className="w-16 text-right">Ideal</Th>
                <Th className="w-16 text-right">Sugerido</Th>
                <Th className="w-14 text-center">Tiendas</Th>
                <Th className="w-24 text-right">Impacto Est.</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
              {paginatedRows.map((row, i) => (
                <tr key={row.key} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
                  <td className="px-3 py-2.5 text-center text-[11px] tabular-nums text-gray-300 dark:text-gray-600">
                    {page * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {row.description || "Sin descripción"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                      {row.skuComercial || row.sku}
                      {row.skuComercial && (
                        <span className="ml-1 text-gray-300 dark:text-gray-600">({row.sku})</span>
                      )}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center font-medium text-gray-700 dark:text-gray-300">
                    {row.talle}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    {row.brand}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {row.linea}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span className="text-sm font-bold tabular-nums text-error-600 dark:text-error-400">
                      {row.totalGapUnits.toLocaleString("es-PY")}
                    </span>
                    <span className="ml-0.5 text-[10px] text-gray-400">u.</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {row.totalIdealUnits.toLocaleString("es-PY")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {row.totalSuggestedUnits.toLocaleString("es-PY")}
                  </td>
                  <td className="px-3 py-2.5 text-center text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {row.storeCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-medium tabular-nums text-gray-700 dark:text-gray-300">
                    {formatPYGSuffix(row.estimatedRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/60">
                <td colSpan={5} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Total{isFiltered ? " (filtrado)" : ""}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <span className="text-sm font-bold tabular-nums text-error-600 dark:text-error-400">
                    {displayTotals.totalGapUnits.toLocaleString("es-PY")}
                  </span>
                  <span className="ml-0.5 text-[10px] text-gray-400">u.</span>
                </td>
                <td colSpan={3} />
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-300">
                  {formatPYGSuffix(displayTotals.totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5 dark:border-gray-700/30">
            <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} de {filteredRows.length}
            </span>
            <div className="flex items-center gap-0.5">
              <PageBtn onClick={() => setPage(0)} disabled={page === 0}>&laquo;</PageBtn>
              <PageBtn onClick={() => setPage(p => p - 1)} disabled={page === 0}>&lsaquo;</PageBtn>
              <span className="px-2.5 text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-400">
                {page + 1}/{totalPages}
              </span>
              <PageBtn onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>&rsaquo;</PageBtn>
              <PageBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>&raquo;</PageBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared UI helpers ───────────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 ${className ?? ""}`}>
      {children}
    </th>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-brand-500 font-semibold text-white"
          : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function PageBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}
