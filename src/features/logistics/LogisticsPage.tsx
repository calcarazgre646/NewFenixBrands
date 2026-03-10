/**
 * features/logistics/LogisticsPage.tsx
 *
 * Logistica / ETAs de Importacion.
 *
 * Secciones:
 *   1. Header global: filtro de marca (avatares, consistente con Inicio/Ventas/Acciones)
 *   2. Filtros in-page: categoria, ver pasados
 *   3. Summary cards (ordenes activas, unidades, atrasados, proxima llegada, por origen)
 *   4. Tabla agrupada por orden (marca + proveedor + ETA), expandible
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState, useCallback } from "react";
import { useLogistics } from "./hooks/useLogistics";
import { statusLabel } from "@/domain/logistics/arrivals";
import { Badge } from "@/components/ui/badge/Badge";
import { Card } from "@/components/ui/card/Card";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import type { ArrivalStatus, LogisticsGroup, LogisticsArrival } from "@/domain/logistics/types";

// ─── Status badge styles ─────────────────────────────────────────────────────

const STATUS_STYLE: Record<ArrivalStatus, string> = {
  overdue:    "bg-error-100 dark:bg-error-500/15 text-error-700 dark:text-error-400",
  past:       "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
  this_month: "bg-warning-100 dark:bg-warning-500/15 text-warning-700 dark:text-warning-400",
  next_month: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400",
  upcoming:   "bg-success-100 dark:bg-success-500/15 text-success-700 dark:text-success-400",
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

function LogisticsStatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card padding="sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
        {label}
      </p>
      {children}
    </Card>
  );
}

// ─── Chevron icon ────────────────────────────────────────────────────────────

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${className ?? "h-4 w-4 text-gray-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ─── PVP Range helper ────────────────────────────────────────────────────────

function pvpRange(rows: LogisticsArrival[]): string {
  const vals = rows.map(r => r.pvpB2C).filter(v => v > 0);
  if (vals.length === 0) return "—";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return min.toLocaleString("es-PY");
  return `${min.toLocaleString("es-PY")}–${max.toLocaleString("es-PY")}`;
}

function marginRange(rows: LogisticsArrival[]): { label: string; value: number } {
  const vals = rows.map(r => r.marginB2C).filter(v => v > 0);
  if (vals.length === 0) return { label: "—", value: 0 };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (min === max) return { label: `${min}%`, value: min };
  return { label: `${min}–${max}%`, value: avg };
}

// ─── Group Row ───────────────────────────────────────────────────────────────

function GroupRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: LogisticsGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const margin = marginRange(group.rows);

  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        tabIndex={0}
        role="row"
        aria-expanded={isExpanded}
        className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
          group.status === "past" ? "opacity-50" : ""
        } ${group.status === "overdue" ? "bg-error-50/30 dark:bg-error-500/[0.03]" : ""}`}
      >
        {/* Expand */}
        <td className="w-8 px-3 py-3">
          <ChevronIcon open={isExpanded} />
        </td>

        {/* ETA */}
        <td className="whitespace-nowrap px-3 py-3">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            {group.dateLabel}
          </span>
        </td>

        {/* Estado */}
        <td className="px-3 py-3">
          <Badge
            text={statusLabel(group.status, group.daysUntil)}
            className={STATUS_STYLE[group.status]}
          />
        </td>

        {/* Marca */}
        <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300">
          {group.brand}
        </td>

        {/* Proveedor */}
        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {group.supplier || "—"}
        </td>

        {/* Categorias */}
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {group.categories.slice(0, 2).map(c => (
              <Badge
                key={c}
                text={c}
                className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"
              />
            ))}
            {group.categories.length > 2 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                +{group.categories.length - 2}
              </span>
            )}
          </div>
        </td>

        {/* Origen */}
        <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
          {group.origin || "—"}
        </td>

        {/* Unidades */}
        <td className="px-3 py-3">
          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
            {group.totalUnits.toLocaleString("es-PY")}
          </span>
          {group.rows.length > 1 && (
            <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
              ({group.rows.length} lineas)
            </span>
          )}
        </td>

        {/* PVP B2C — rango si hay variación */}
        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {pvpRange(group.rows)}
        </td>

        {/* Margen B2C — rango si hay variación */}
        <td className="px-3 py-3">
          {margin.value > 0 ? (
            <span className="text-xs font-semibold text-success-600 dark:text-success-400">
              {margin.label}
            </span>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
          )}
        </td>
      </tr>

      {/* Child rows */}
      {isExpanded && group.rows.map((row, ri) => (
        <ChildRow key={`${group.key}-${row.description}-${row.color}-${ri}`} row={row} />
      ))}
    </>
  );
}

// ─── Child Row (detail per line) ─────────────────────────────────────────────

function ChildRow({ row }: { row: LogisticsArrival }) {
  return (
    <tr className="bg-gray-50/60 transition-colors hover:bg-gray-50 dark:bg-white/[0.01] dark:hover:bg-white/[0.03]">
      <td className="px-3 py-2.5" />
      {/* Descripción del producto */}
      <td colSpan={2} className="px-3 py-2.5">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {row.description || "Sin descripcion"}
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          {row.season ? `Temp. ${row.season}` : ""}
        </p>
      </td>
      {/* Color */}
      <td className="px-3 py-2.5">
        {row.color ? (
          <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-600" />
            {row.color}
          </span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
      <td className="px-3 py-2.5" />
      {/* Categoria */}
      <td className="px-3 py-2.5">
        {row.category ? (
          <Badge text={row.category} className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" />
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
      <td className="px-3 py-2.5" />
      {/* Unidades */}
      <td className="px-3 py-2.5">
        <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {row.quantity.toLocaleString("es-PY")}
        </span>
      </td>
      {/* PVP B2C */}
      <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-gray-600 dark:text-gray-400">
        {row.pvpB2C > 0 ? row.pvpB2C.toLocaleString("es-PY") : "—"}
      </td>
      {/* Margen B2C */}
      <td className="px-3 py-2.5">
        {row.marginB2C > 0 ? (
          <span className="text-xs font-semibold text-success-600 dark:text-success-400">
            {row.marginB2C}%
          </span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function LogisticsPage() {
  const {
    groups,
    summary,
    showPast,
    togglePast,
    isLoading,
    error,
    hiddenPastCount,
  } = useLogistics();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(groups.map(g => g.key)));
  }, [groups]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-error-700 dark:text-error-400">{error}</p>
        </div>
      </div>
    );
  }

  const COLS = ["", "ETA", "Estado", "Marca", "Proveedor", "Categorias", "Origen", "Unidades", "PVP B2C", "Margen B2C"];

  return (
    <div className="space-y-5 p-4 sm:p-6">

      {/* ═══ FILTER ROW ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => !showPast || togglePast()}
            className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              !showPast
                ? "bg-brand-500 font-semibold text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => showPast || togglePast()}
            className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              showPast
                ? "bg-brand-500 font-semibold text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            Todos{!showPast && hiddenPastCount > 0 && (
              <span className="ml-1 font-normal opacity-70">+{hiddenPastCount}</span>
            )}
          </button>
        </div>

        <div className="ml-auto text-xs text-gray-400">
          {groups.length} orden{groups.length !== 1 ? "es" : ""}
        </div>
      </div>

      {/* ═══ Summary cards ═══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <LogisticsStatCard label="Ordenes activas">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.activeOrders}</p>
        </LogisticsStatCard>
        <LogisticsStatCard label="Unidades en transito">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.totalUnits.toLocaleString("es-PY")}
          </p>
        </LogisticsStatCard>
        {summary.overdueCount > 0 && (
          <LogisticsStatCard label="Atrasados">
            <p className="text-2xl font-bold text-error-600 dark:text-error-400">{summary.overdueCount}</p>
          </LogisticsStatCard>
        )}
        <LogisticsStatCard label="Proxima llegada">
          <p className="text-sm font-bold text-brand-600 dark:text-brand-400 leading-tight">
            {summary.nextDate}
          </p>
        </LogisticsStatCard>
        <LogisticsStatCard label="Por origen">
          <div className="space-y-0.5">
            {Object.entries(summary.byOrigin)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([orig, units]) => (
                <div key={orig} className="flex justify-between text-xs">
                  <span className="truncate text-gray-500 dark:text-gray-400">{orig}</span>
                  <span className="ml-2 font-semibold text-gray-700 dark:text-gray-300">
                    {units.toLocaleString("es-PY")}
                  </span>
                </div>
              ))}
            {Object.keys(summary.byOrigin).length > 3 && (
              <p className="text-[10px] text-gray-400">+{Object.keys(summary.byOrigin).length - 3} mas</p>
            )}
          </div>
        </LogisticsStatCard>
      </div>

      {/* ═══ Table ═══ */}
      <Card padding="none" className="overflow-x-auto">
        {/* Toolbar */}
        {groups.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
            {expanded.size < groups.length && (
              <button
                onClick={expandAll}
                className="text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                Expandir todo
              </button>
            )}
            {expanded.size > 0 && (
              <button
                onClick={collapseAll}
                className="text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                Colapsar todo
              </button>
            )}
          </div>
        )}

        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              {COLS.map(h => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                  No hay pedidos para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              groups.map(group => (
                <GroupRow
                  key={group.key}
                  group={group}
                  isExpanded={expanded.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                />
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
