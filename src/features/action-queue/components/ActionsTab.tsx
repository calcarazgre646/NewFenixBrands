/**
 * features/action-queue/components/ActionsTab.tsx
 *
 * Pestaña "Acciones" del Centro de Acciones.
 * Contiene: controles (Pareto, vista), stats de acciones, grupos agrupados.
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState, useMemo } from "react";
import { ActionGroupCard } from "./ActionGroupCard";
import { groupActions } from "@/domain/actionQueue/grouping";
import type { GroupByMode } from "@/domain/actionQueue/grouping";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import { useStoreConfig } from "@/hooks/useConfig";
import { useAuth } from "@/context/AuthContext";
import { getUserViewProfile } from "@/domain/auth/types";
import type { ViewProfile } from "@/domain/auth/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "store" | "brand";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  items: ActionItemFull[];
  storeStockMap: Map<string, number>;
  totalItems: number;
  stockoutCount: number;
  lifecycleCriticalCount: number;
  lowCount: number;
  overstockCount: number;
  uniqueSkus: number;
  movementCount: number;
  lifecycleCount: number;
  channel: "b2c" | "b2b";
  brand: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ActionsTab({
  items,
  storeStockMap,
  totalItems,
  stockoutCount,
  lifecycleCriticalCount,
  lowCount,
  overstockCount,
  uniqueSkus,
  movementCount,
  lifecycleCount,
  channel,
  brand,
}: Props) {
  const storeConfig = useStoreConfig();
  const { profile } = useAuth();
  const defaultProfile = getUserViewProfile(profile?.role ?? "negocio", profile?.cargo);
  const [viewMode, setViewMode] = useState<ViewMode>("store");
  const [showParetoOnly, setShowParetoOnly] = useState(true);
  const [viewProfile, setViewProfile] = useState<ViewProfile>(defaultProfile);
  const canToggleProfile = profile?.role === "super_user" || profile?.role === "gerencia";

  const visibleItems = useMemo(() => {
    if (!showParetoOnly) return items;
    return items.filter(i => i.paretoFlag);
  }, [items, showParetoOnly]);

  const visibleCount = visibleItems.length;

  const groups = useMemo(
    () => groupActions(visibleItems, viewMode as GroupByMode, storeConfig.clusters, storeConfig.timeRestrictions, storeConfig.assortments),
    [visibleItems, viewMode, storeConfig.clusters, storeConfig.timeRestrictions, storeConfig.assortments],
  );

  return (
    <div className="space-y-6">
      {/* ═══ CONTEXT ROW ═══ */}
      <div className="exec-anim-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Pareto 20/80 · Umbral Gs. 500K
            </span>
            {totalItems > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-600 dark:text-success-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Linealidad STH activa
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Pareto toggle */}
            <SegmentedControl
              options={[
                { value: "pareto", label: "Pareto 80%" },
                { value: "all", label: "Todo" },
              ]}
              active={showParetoOnly ? "pareto" : "all"}
              onChange={(v) => setShowParetoOnly(v === "pareto")}
            />
            {/* View mode */}
            <SegmentedControl
              options={[
                { value: "store", label: "Tienda", icon: <StoreIcon /> },
                { value: "brand", label: "Marca", icon: <BrandIcon /> },
              ]}
              active={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
            />
            {/* Profile bracket toggle (Rule 10 — only for super_user/gerencia) */}
            {canToggleProfile && (
              <SegmentedControl
                options={[
                  { value: "detail", label: "Detalle 15d" },
                  { value: "executive", label: "Ejecutivo 45d" },
                ]}
                active={viewProfile}
                onChange={(v) => setViewProfile(v as ViewProfile)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <div className="exec-anim-2 space-y-3">
        {/* Row 1: Resumen ejecutivo — qué produce el motor */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Movimientos"
            value={String(movementCount)}
            sub="Mover stock entre ubicaciones"
          />
          <StatCard
            label="Intervenciones"
            value={String(lifecycleCount)}
            sub={lifecycleCriticalCount > 0 ? `${lifecycleCriticalCount} de salida obligatoria` : "Requieren decisión comercial"}
            variant={lifecycleCount > 0 ? "accent-negative" : "neutral"}
          />
          <StatCard
            label="SKUs Afectados"
            value={String(uniqueSkus)}
            sub={`${totalItems.toLocaleString("es-PY")} acciones en total`}
          />
        </div>
        {/* Row 2: Detalle de riesgo — dónde está el problema */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Sin Stock"
            value={String(stockoutCount)}
            sub="SKUs con 0 unidades en tienda"
            variant={stockoutCount > 0 ? "negative" : "neutral"}
          />
          <StatCard
            label="Stock Bajo"
            value={String(lowCount)}
            sub="SKUs bajo cobertura objetivo"
            variant={lowCount > 0 ? "accent-negative" : "neutral"}
          />
          <StatCard
            label="Sobrestock"
            value={String(overstockCount)}
            sub="SKUs sobre cobertura objetivo"
          />
        </div>
        {/* Row 3 removed: analyses are integrated into the decision engine, not shown as stats */}
      </div>

      {/* ═══ GROUPS ═══ */}
      {groups.length === 0 ? (
        <div className="exec-anim-3 rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No se encontraron acciones con los filtros actuales.
          </p>
        </div>
      ) : (
        <>
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

          <div className="space-y-3" key={`${viewMode}-${channel}-${brand}-${showParetoOnly}`}>
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
                  channel={channel}
                  defaultExpanded={groups.length === 1}
                  storeStock={viewMode === "store" ? storeStockMap.get(group.key) ?? null : null}
                  viewProfile={viewProfile}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  active,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700" role="tablist">
      {options.map(({ value, label, icon }) => (
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
          <span className={icon ? "hidden sm:inline" : ""}>{label}</span>
        </button>
      ))}
    </div>
  );
}

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
