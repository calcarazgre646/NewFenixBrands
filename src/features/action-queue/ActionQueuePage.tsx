/**
 * features/action-queue/ActionQueuePage.tsx
 *
 * Cola de Acciones priorizadas por algoritmo waterfall.
 *
 * Secciones:
 *   1. Header + channel toggle (B2C / B2B)
 *   2. Filter bar (marca, linea de producto, tienda) + export
 *   3. Pareto summary + stats
 *   4. Action table (13 columns)
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState } from "react";
import { useActionQueue } from "./hooks/useActionQueue";
import { ActionQueueTable } from "./components/ActionQueueTable";
import { downloadActionQueueHtml } from "./components/exportHtml";

// ─── Loading skeleton ────────────────────────────────────────────────────────

function ActionQueueSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="h-12 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
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

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ActionQueuePage() {
  const {
    items,
    totalItems,
    paretoCount,
    criticalCount,
    lowCount,
    overstockCount,
    uniqueSkus,
    filters,
    setChannel,
    setBrand,
    setLinea,
    setCategoria,
    setStore,
    clearFilters,
    hasFilters,
    isLoading,
    isHistoryLoading,
    error,
    availableBrands,
    availableLineas,
    availableCategorias,
    availableStores,
  } = useActionQueue();

  const [showHistory, setShowHistory] = useState(false);

  if (isLoading) return <ActionQueueSkeleton />;

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-error-700 dark:text-error-400">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Cola de Acciones
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Waterfall: Tienda↔Tienda → RETAILS→Tienda → STOCK→RETAILS · Pareto 20/80
          </p>
        </div>

        {/* B2C / B2B toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          <ChannelButton active={filters.channel === "b2c"} onClick={() => setChannel("b2c")}>
            B2C
          </ChannelButton>
          <ChannelButton active={filters.channel === "b2b"} onClick={() => setChannel("b2b")}>
            B2B
          </ChannelButton>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <FilterSelect label="Marca" value={filters.brand} options={availableBrands} onChange={setBrand} />
        <FilterSelect label="Linea" value={filters.linea} options={availableLineas} onChange={setLinea} />
        <FilterSelect label="Categoria" value={filters.categoria} options={availableCategorias} onChange={setCategoria} />
        <FilterSelect label="Tienda" value={filters.store} options={availableStores} onChange={setStore} />

        {/* History toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showHistory
              ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          }`}
        >
          {showHistory ? "Ocultar Prom." : "Prom. 12m"}
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Limpiar filtros
          </button>
        )}

        {/* Spacer + Export + Status */}
        <div className="ml-auto flex items-center gap-3">
          {isHistoryLoading && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              Cargando historial...
            </span>
          )}
          {!isHistoryLoading && totalItems > 0 && (
            <span className="text-[10px] text-gray-400">
              &#10003; Historial 12m cargado
            </span>
          )}

          <button
            onClick={() => downloadActionQueueHtml(items, filters.channel)}
            disabled={totalItems === 0}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            Exportar HTML
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Acciones" value={totalItems} color="text-gray-900 dark:text-white" />
        <StatCard label="SKUs Unicos" value={uniqueSkus} color="text-gray-900 dark:text-white" />
        {paretoCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{paretoCount}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
              Pareto 80%
            </p>
          </div>
        )}
        <StatCard label="Sin Stock" value={criticalCount} color="text-error-600 dark:text-error-400" />
        <StatCard label="Stock Bajo" value={lowCount} color="text-warning-600 dark:text-warning-400" />
        <StatCard label="Sobrestock" value={overstockCount} color="text-blue-600 dark:text-blue-400" />
      </div>

      {/* Table */}
      <ActionQueueTable items={items} showHistory={showHistory} />
    </div>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function ChannelButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-brand-600 text-white dark:bg-brand-500"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
