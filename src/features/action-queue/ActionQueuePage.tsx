/**
 * features/action-queue/ActionQueuePage.tsx
 *
 * Centro de Acciones priorizadas por algoritmo waterfall.
 *
 * Dos vistas intercambiables:
 *   - Tienda: Grupos por tienda con cluster, horario, assortment
 *   - Marca:  Grupos por marca con impacto total
 *
 * UI consistente con ExecutivePage y SalesPage (TailAdmin design system).
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState, useMemo } from "react";
import { useActionQueue } from "./hooks/useActionQueue";
import { ActionGroupCard } from "./components/ActionGroupCard";
import { groupActions } from "@/domain/actionQueue/grouping";
import type { GroupByMode } from "@/domain/actionQueue/grouping";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { ActionQueueLoader } from "./components/ActionQueueLoader";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "store" | "brand";

// ─── View icon components ────────────────────────────────────────────────────

function StoreIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function BrandIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ActionQueuePage() {
  const {
    items,
    storeStockMap,
    totalItems,
    paretoCount,
    criticalCount,
    lowCount,
    overstockCount,
    uniqueSkus,
    filters,
    setChannel,
    isLoading,
    isHistoryLoading,
    error,
    loadingProgress,
  } = useActionQueue();

  const [viewMode, setViewMode] = useState<ViewMode>("store");
  const [showParetoOnly, setShowParetoOnly] = useState(true);

  // ── Pareto filter ────────────────────────────────────────────────────────
  const visibleItems = useMemo(() => {
    if (!showParetoOnly) return items;
    return items.filter(i => i.paretoFlag);
  }, [items, showParetoOnly]);

  const visibleCount = visibleItems.length;

  // ── Grouped data ───────────────────────────────────────────────────────
  const groups = useMemo(
    () => groupActions(visibleItems, viewMode as GroupByMode),
    [visibleItems, viewMode],
  );

  if (isLoading) return <ActionQueueLoader progress={loadingProgress} />;

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-error-700 dark:text-error-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* ═══ TIER 1: CONTEXT ROW — consistent with Inicio/Ventas ═══ */}
      <div className="exec-anim-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: data freshness context */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Pareto 20/80 · Umbral Gs. 500K
            </span>
            {isHistoryLoading && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-gray-400">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                Cargando historial…
              </span>
            )}
            {!isHistoryLoading && totalItems > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-600 dark:text-success-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Historial 6m
              </span>
            )}
          </div>

          {/* Right: pareto + channel + view selector — consistent segmented controls */}
          <div className="flex items-center gap-3">
            {/* Pareto filter toggle */}
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowParetoOnly(true)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
                  showParetoOnly
                    ? "bg-brand-500 font-semibold text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                Pareto 80%
              </button>
              <button
                type="button"
                onClick={() => setShowParetoOnly(false)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
                  !showParetoOnly
                    ? "bg-brand-500 font-semibold text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                Todo
              </button>
            </div>

            {/* Channel selector */}
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setChannel("b2c")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
                  filters.channel === "b2c"
                    ? "bg-brand-500 font-semibold text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                B2C
              </button>
              <button
                type="button"
                onClick={() => setChannel("b2b")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
                  filters.channel === "b2b"
                    ? "bg-brand-500 font-semibold text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                B2B
              </button>
            </div>

            {/* View mode selector */}
            <ViewSelector active={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* ═══ TIER 1: Stats row — uses design-system StatCard ═══ */}
      <div className="exec-anim-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Acciones" value={String(totalItems)} />
        <StatCard label="SKUs Únicos" value={String(uniqueSkus)} />
        <StatCard
          label="Pareto 80%"
          value={String(paretoCount)}
          sub={paretoCount > 0 ? `${((paretoCount / totalItems) * 100).toFixed(0)}% del total` : undefined}
          variant={paretoCount > 0 ? "accent-positive" : "neutral"}
        />
        <StatCard
          label="Sin Stock"
          value={String(criticalCount)}
          variant={criticalCount > 0 ? "negative" : "neutral"}
        />
        <StatCard
          label="Stock Bajo"
          value={String(lowCount)}
          variant={lowCount > 0 ? "accent-negative" : "neutral"}
        />
        <StatCard label="Sobrestock" value={String(overstockCount)} />
      </div>

      {/* ═══ TIER 2: Content area ═══ */}
      {groups.length === 0 ? (
        <div className="exec-anim-3 rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No se encontraron acciones con los filtros actuales.
          </p>
        </div>
      ) : (
        <>
          {/* Group count context */}
          <div className="exec-anim-3 flex items-center gap-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {groups.length} {viewMode === "store" ? "tiendas" : "marcas"}
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              {visibleCount} acciones
              {showParetoOnly && totalItems > visibleCount && (
                <span className="ml-1 text-gray-400 dark:text-gray-500">
                  de {totalItems} total
                </span>
              )}
            </p>
          </div>

          {/* Group cards — staggered cascade, all cards animate top-down */}
          <div className="space-y-3" key={`${viewMode}-${filters.channel}-${filters.brand}-${showParetoOnly}`}>
            {groups.map((group, idx) => (
              <div
                key={group.key}
                style={{
                  animation: `exec-fade-slide-up 0.4s var(--ease-out) ${200 + idx * 40}ms both`,
                }}
              >
                <ActionGroupCard
                  group={group}
                  mode={viewMode as GroupByMode}
                  channel={filters.channel}
                  defaultExpanded={groups.length === 1}
                  storeStock={viewMode === "store" ? storeStockMap.get(group.key) ?? null : null}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── View Selector ───────────────────────────────────────────────────────────

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string; icon: React.ReactNode }> = [
  { value: "store", label: "Tienda", icon: <StoreIcon /> },
  { value: "brand", label: "Marca",  icon: <BrandIcon /> },
];

function ViewSelector({ active, onChange }: { active: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700" role="tablist">
      {VIEW_OPTIONS.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={active === value}
          onClick={() => onChange(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
            active === value
              ? "bg-brand-500 font-semibold text-white"
              : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          }`}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

