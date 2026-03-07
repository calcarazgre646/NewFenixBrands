/**
 * features/logistics/LogisticsPage.tsx
 *
 * Logistica / ETAs de Importacion.
 *
 * Secciones:
 *   1. Header + filtros (marca, categoria, ver pasados)
 *   2. Summary cards (ordenes activas, unidades, proxima llegada, por origen)
 *   3. Tabla agrupada por orden (marca + proveedor + ETA), expandible
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState } from "react";
import { useLogistics } from "./hooks/useLogistics";
import { statusLabel } from "@/domain/logistics/arrivals";
import type { ArrivalStatus, LogisticsGroup, LogisticsArrival } from "@/domain/logistics/types";

// ─── Status badge styles ─────────────────────────────────────────────────────

const STATUS_STYLE: Record<ArrivalStatus, string> = {
  past:       "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
  this_month: "bg-warning-100 dark:bg-warning-500/15 text-warning-700 dark:text-warning-400",
  next_month: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400",
  upcoming:   "bg-success-100 dark:bg-success-500/15 text-success-700 dark:text-success-400",
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function LogisticsSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

// ─── Filter Select ───────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {text}
    </span>
  );
}

// ─── Chevron icons (inline SVG) ──────────────────────────────────────────────

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
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
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
          group.status === "past" ? "opacity-50" : ""
        }`}
      >
        {/* Expand */}
        <td className="w-8 px-3 py-3">
          <span className="text-gray-400 dark:text-gray-500">
            {isExpanded
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </span>
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

        {/* PVP B2C */}
        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {group.rows[0].pvpB2C > 0 ? group.rows[0].pvpB2C.toLocaleString("es-PY") : "—"}
        </td>

        {/* Margen B2C */}
        <td className="px-3 py-3">
          {group.rows[0].marginB2C > 0 ? (
            <span className="text-xs font-semibold text-success-600 dark:text-success-400">
              {group.rows[0].marginB2C}%
            </span>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
          )}
        </td>
      </tr>

      {/* Child rows */}
      {isExpanded && group.rows.map((row, ri) => (
        <ChildRow key={`${group.key}-${ri}`} row={row} />
      ))}
    </>
  );
}

// ─── Child Row (detail per category) ─────────────────────────────────────────

function ChildRow({ row }: { row: LogisticsArrival }) {
  return (
    <tr className="bg-gray-50/60 transition-colors hover:bg-gray-50 dark:bg-white/[0.01] dark:hover:bg-white/[0.03]">
      <td className="px-3 py-2.5" />
      <td className="px-3 py-2.5" />
      <td className="px-3 py-2.5" />
      <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500">
        {row.season || "—"}
      </td>
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
      <td className="px-3 py-2.5">
        {row.category ? (
          <Badge text={row.category} className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" />
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
      <td className="px-3 py-2.5" />
      <td className="px-3 py-2.5">
        <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {row.quantity.toLocaleString("es-PY")}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-gray-600 dark:text-gray-400">
        {row.pvpB2C > 0 ? row.pvpB2C.toLocaleString("es-PY") : "—"}
      </td>
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
    filters,
    setBrand,
    setCategory,
    togglePast,
    clearFilters,
    hasFilters,
    isLoading,
    error,
    availableBrands,
    availableCategories,
  } = useLogistics();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (isLoading) return <LogisticsSkeleton />;

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
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Logistica / ETAs
        </h1>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Pedidos de importacion con fechas estimadas de arribo por marca
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <FilterSelect label="Marca" value={filters.brand} options={availableBrands} onChange={setBrand} />
        <FilterSelect label="Categoria" value={filters.category} options={availableCategories} onChange={setCategory} />

        <button
          onClick={togglePast}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filters.showPast
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          }`}
        >
          {filters.showPast ? "Ocultar pasados" : "Ver pasados"}
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Limpiar filtros
          </button>
        )}

        <div className="ml-auto text-xs text-gray-400">
          {groups.length} orden{groups.length !== 1 ? "es" : ""}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ordenes activas">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.activeOrders}</p>
        </StatCard>
        <StatCard label="Unidades en transito">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.totalUnits.toLocaleString("es-PY")}
          </p>
        </StatCard>
        <StatCard label="Proxima llegada">
          <p className="text-sm font-bold text-brand-600 dark:text-brand-400 leading-tight">
            {summary.nextDate}
          </p>
        </StatCard>
        <StatCard label="Por origen">
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
          </div>
        </StatCard>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Toolbar */}
        {expanded.size > 0 && (
          <div className="flex items-center justify-end border-b border-gray-100 px-4 py-2 dark:border-gray-700">
            <button
              onClick={() => setExpanded(new Set())}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Colapsar todo
            </button>
          </div>
        )}

        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              {COLS.map(h => (
                <th
                  key={h}
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
      </div>
    </div>
  );
}
