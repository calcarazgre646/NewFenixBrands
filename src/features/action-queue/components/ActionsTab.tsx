/**
 * features/action-queue/components/ActionsTab.tsx
 *
 * Pestaña "Acciones" del Centro de Acciones.
 *
 * 3 vistas de agrupación, cada una con estructura visual propia:
 *   - Tienda:    ActionGroupCard (secciones por intent → tarjetas)
 *   - Prioridad: FlatGroupSection (header + grid directo)
 *   - Marca:     FlatGroupSection (header + grid directo)
 *
 * Filtros siempre visibles: búsqueda por texto + chips por tipo.
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ActionGroupCard } from "./ActionGroupCard";
import { FlatGroupSection } from "./FlatGroupSection";
import { ActionCard } from "./ActionCard";
import { ActionFilters } from "./ActionFilters";
import { filterActions, countByFilterType, type ActionFilterType } from "./ActionFilters.utils";
import { groupActions } from "@/domain/actionQueue/grouping";
import type { GroupByMode, ActionGroup } from "@/domain/actionQueue/grouping";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import { useStoreConfig } from "@/hooks/useConfig";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "store" | "priority" | "brand";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  items: ActionItemFull[];
  storeStockMap: Map<string, number>;
  totalItems: number;
  channel: "b2c" | "b2b";
  brand: string;
  /** Deep-link: auto-expand this store group */
  expandStore?: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ActionsTab({
  items,
  storeStockMap,
  channel,
  brand,
  expandStore,
}: Props) {
  const storeConfig = useStoreConfig();
  const [viewMode, setViewMode] = useState<ViewMode>(() => expandStore ? "store" : "priority");

  // Filters
  const [filterType, setFilterType] = useState<ActionFilterType>("all");
  const handleFilterTypeChange = useCallback((v: ActionFilterType) => setFilterType(v), []);

  // Pipeline: items → type filter → group
  const filteredItems = useMemo(
    () => filterActions(items, "", filterType),
    [items, filterType],
  );

  const filterCounts = useMemo(
    () => countByFilterType(items),
    [items],
  );

  const groups = useMemo(
    () => groupActions(filteredItems, viewMode as GroupByMode, storeConfig.clusters, storeConfig.timeRestrictions, storeConfig.assortments),
    [filteredItems, viewMode, storeConfig.clusters, storeConfig.timeRestrictions, storeConfig.assortments],
  );

  const groupLabel = viewMode === "store" ? "tiendas" : viewMode === "brand" ? "marcas" : "niveles";

  return (
    <div className="space-y-5">
      {/* ═══ CONTROLS ROW: view mode + type filters ═══ */}
      <div className="exec-anim-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            options={[
              { value: "priority", label: "Prioridad", icon: <PriorityIcon /> },
              { value: "store", label: "Tienda", icon: <StoreIcon /> },
              { value: "brand", label: "Marca", icon: <BrandIcon /> },
            ]}
            active={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
          />
          <ActionFilters
            filterType={filterType}
            onFilterTypeChange={handleFilterTypeChange}
            counts={filterCounts}
          />
        </div>
      </div>

      {/* ═══ STATS — dynamic per active filter ═══ */}
      <FilterStats items={filteredItems} filterType={filterType} />

      {/* ═══ HIGHLIGHT — contextual per view + filter ═══ */}
      {viewMode === "priority" && filteredItems.length > 5 && (
        <HighlightCarousel items={filteredItems} filterType={filterType} />
      )}
      {viewMode === "store" && groups.length > 3 && (
        <StoreHighlightCarousel groups={groups} items={filteredItems} filterType={filterType} onStoreClick={(key) => {
          const el = document.getElementById(`group-${key}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }} />
      )}

      {/* ═══ GROUPS ═══ */}
      {groups.length === 0 ? (
        <div className="exec-anim-3 rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No se encontraron acciones con los filtros actuales.
          </p>
          {filterType !== "all" && (
            <button
              onClick={() => setFilterType("all")}
              className="mt-2 text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="exec-anim-3 flex items-center gap-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {groups.length} {groupLabel}
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              {filteredItems.length} {filterType === "all" ? "acciones" : filterType === "reposition" ? "reposiciones" : filterType === "redistribute" ? "redistribuciones" : filterType === "size_curve" ? "curvas de tallas" : filterType === "lifecycle" ? "intervenciones" : filterType === "exit" ? "salidas" : "acciones"}
            </p>
          </div>

          <div className="space-y-4" key={`${viewMode}-${channel}-${brand}-${filterType}`}>
            {groups.map((group, idx) => (
              <div
                key={group.key}
                id={`group-${group.key}`}
                style={{
                  animation: `exec-fade-slide-up 0.4s var(--ease-out) ${200 + idx * 40}ms both`,
                }}
              >
                {viewMode === "store" ? (
                  /* Tienda: secciones por intent → tarjetas dentro de cada sección */
                  <ActionGroupCard
                    group={group}
                    mode="store"
                    channel={channel}
                    defaultExpanded={groups.length === 1 || group.key === expandStore}
                    storeStock={storeStockMap.get(group.key) ?? null}
                  />
                ) : (
                  /* Prioridad y Marca: header plano + grid directo de tarjetas */
                  <FlatGroupSection
                    group={group}
                    mode={viewMode as GroupByMode}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Top impact highlight (priority view) ───────────────────────────────────

// ─── Highlight config per filter ─────────────────────────────────────────────

const HIGHLIGHT_CONFIG: Record<ActionFilterType, {
  title: string;
  icon: "star" | "gap" | "excess" | "curve" | "clock" | "alert";
  pillColor: string;
  sortFn: (a: ActionItemFull, b: ActionItemFull) => number;
  pillText: (items: ActionItemFull[]) => string;
}> = {
  all: {
    title: "Mayor Impacto",
    icon: "star",
    pillColor: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400",
    sortFn: (a, b) => b.impactScore - a.impactScore,
    pillText: (items) => {
      const total = items.reduce((s, i) => s + i.impactScore, 0);
      return `${fmtGsStatic(total)} impacto potencial`;
    },
  },
  reposition: {
    title: "Mayor Demanda Insatisfecha",
    icon: "gap",
    pillColor: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
    sortFn: (a, b) => b.gapUnits - a.gapUnits,
    pillText: (items) => {
      const total = items.reduce((s, i) => s + i.gapUnits, 0);
      return `${total.toLocaleString("es-PY")} u. de gap`;
    },
  },
  redistribute: {
    title: "Mayor Excedente",
    icon: "excess",
    pillColor: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    sortFn: (a, b) => b.currentStock - a.currentStock,
    pillText: (items) => {
      const total = items.reduce((s, i) => s + i.currentStock, 0);
      return `${total.toLocaleString("es-PY")} u. en exceso`;
    },
  },
  size_curve: {
    title: "Menor Cobertura",
    icon: "curve",
    pillColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    sortFn: (a, b) => (a.sizeCurveCoverage ?? 100) - (b.sizeCurveCoverage ?? 100),
    pillText: (items) => {
      const avg = items.length > 0 ? items.reduce((s, i) => s + (i.sizeCurveCoverage ?? 0), 0) / items.length : 0;
      return `${avg.toFixed(0)}% cobertura promedio`;
    },
  },
  lifecycle: {
    title: "Próximos a Salida",
    icon: "clock",
    pillColor: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400",
    sortFn: (a, b) => (b.cohortAgeDays ?? 0) - (a.cohortAgeDays ?? 0),
    pillText: (items) => {
      const avg = items.length > 0 ? Math.round(items.reduce((s, i) => s + Math.max(0, 90 - (i.cohortAgeDays ?? 0)), 0) / items.length) : 0;
      return `${avg}d promedio restantes`;
    },
  },
  exit: {
    title: "Mayor Antigüedad",
    icon: "alert",
    pillColor: "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400",
    sortFn: (a, b) => (b.cohortAgeDays ?? 0) - (a.cohortAgeDays ?? 0),
    pillText: (items) => {
      const avg = items.length > 0 ? Math.round(items.reduce((s, i) => s + Math.max(0, (i.cohortAgeDays ?? 0) - 90), 0) / items.length) : 0;
      return `${avg}d promedio vencidos`;
    },
  },
};

function fmtGsStatic(n: number) {
  if (n >= 1e9) return `₲${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `₲${(n / 1e6).toFixed(1)}M`;
  return `₲${(n / 1e3).toFixed(0)}K`;
}

function HighlightIcon({ type }: { type: string }) {
  const cls = "h-4 w-4";
  switch (type) {
    case "star":
      return <svg className={`${cls} text-brand-500 dark:text-brand-400`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
    case "gap":
      return <svg className={`${cls} text-cyan-500 dark:text-cyan-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
    case "excess":
      return <svg className={`${cls} text-blue-500 dark:text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
    case "curve":
      return <svg className={`${cls} text-indigo-500 dark:text-indigo-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
    case "clock":
      return <svg className={`${cls} text-warning-500 dark:text-warning-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "alert":
      return <svg className={`${cls} text-error-500 dark:text-error-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>;
    default:
      return null;
  }
}

// ─── Highlight carousel ─────────────────────────────────────────────────────

function HighlightCarousel({ items, filterType }: { items: ActionItemFull[]; filterType: ActionFilterType }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const config = HIGHLIGHT_CONFIG[filterType];

  const topItems = useMemo(() => {
    return [...items].sort(config.sortFn).slice(0, 5);
  }, [items, config.sortFn]);

  const pillText = useMemo(() => config.pillText(topItems), [topItems, config]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, topItems]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -300 : 300, behavior: "smooth" });
  };

  if (topItems.length === 0) return null;

  return (
    <div className="exec-anim-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <HighlightIcon type={config.icon} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">{config.title}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold tabular-nums ${config.pillColor}`}>
          {pillText}
        </span>
      </div>

      {/* Scrollable cards — arrows on hover */}
      <div className="group/carousel relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-theme-sm transition-all hover:text-gray-800 group-hover/carousel:sm:flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-theme-sm transition-all hover:text-gray-800 group-hover/carousel:sm:flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1 no-scrollbar"
        >
          {topItems.map((item, idx) => (
            <div
              key={item.id}
              className="w-[280px] shrink-0 [&>*]:h-full"
              style={{ animation: `exec-fade-slide-up 0.3s var(--ease-out) ${idx * 60}ms both` }}
            >
              <ActionCard item={item} showStore />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Store highlight carousel (store view) ──────────────────────────────────

const STORE_HIGHLIGHT_CONFIG: Record<ActionFilterType, {
  title: string;
  icon: string;
  pillColor: string;
  sortFn: (a: ActionGroup, b: ActionGroup) => number;
  metricFn: (g: ActionGroup, items: ActionItemFull[]) => { primary: string; secondary: string };
}> = {
  all: {
    title: "Tiendas Criticas",
    icon: "alert",
    pillColor: "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400",
    sortFn: (a, b) => (b.criticalCount + b.totalImpact / 1e9) - (a.criticalCount + a.totalImpact / 1e9),
    metricFn: (g) => ({
      primary: g.criticalCount > 0 ? `${g.criticalCount} sin stock` : `${g.totalActions} acciones`,
      secondary: fmtGsStatic(g.totalImpact),
    }),
  },
  reposition: {
    title: "Mas Desabastecidas",
    icon: "gap",
    pillColor: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
    sortFn: (a, b) => b.criticalCount - a.criticalCount,
    metricFn: (g) => ({
      primary: `${g.criticalCount} SKUs sin stock`,
      secondary: `${g.totalGapUnits} u. gap`,
    }),
  },
  redistribute: {
    title: "Mayor Excedente",
    icon: "excess",
    pillColor: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    sortFn: (a, b) => b.overstockCount - a.overstockCount,
    metricFn: (g) => ({
      primary: `${g.overstockCount} en exceso`,
      secondary: fmtGsStatic(g.totalImpact),
    }),
  },
  size_curve: {
    title: "Curvas Mas Rotas",
    icon: "curve",
    pillColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    sortFn: (a, b) => b.totalActions - a.totalActions,
    metricFn: (g) => ({
      primary: `${g.totalActions} curvas`,
      secondary: `${g.uniqueSkus} SKUs`,
    }),
  },
  lifecycle: {
    title: "Mas Intervenciones",
    icon: "clock",
    pillColor: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400",
    sortFn: (a, b) => b.totalActions - a.totalActions,
    metricFn: (g) => ({
      primary: `${g.totalActions} intervenciones`,
      secondary: `${g.uniqueSkus} SKUs`,
    }),
  },
  exit: {
    title: "Mas Salidas Pendientes",
    icon: "alert",
    pillColor: "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400",
    sortFn: (a, b) => b.totalActions - a.totalActions,
    metricFn: (g) => ({
      primary: `${g.totalActions} salidas`,
      secondary: `${g.totalUnits} u.`,
    }),
  },
};

const CLUSTER_LABEL: Record<string, string> = { A: "Premium", B: "Standard", OUT: "Outlet" };

function StoreHighlightCarousel({
  groups,
  items,
  filterType,
  onStoreClick,
}: {
  groups: ActionGroup[];
  items: ActionItemFull[];
  filterType: ActionFilterType;
  onStoreClick: (key: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const config = STORE_HIGHLIGHT_CONFIG[filterType];

  const topStores = useMemo(() => {
    return [...groups].sort(config.sortFn).slice(0, 5);
  }, [groups, config.sortFn]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, topStores]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -260 : 260, behavior: "smooth" });
  };

  if (topStores.length === 0) return null;

  return (
    <div className="exec-anim-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <HighlightIcon type={config.icon} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">{config.title}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold tabular-nums ${config.pillColor}`}>
          Top {topStores.length} de {groups.length} tiendas
        </span>
      </div>

      {/* Carousel */}
      <div className="group/carousel relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-theme-sm transition-all hover:text-gray-800 group-hover/carousel:sm:flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-theme-sm transition-all hover:text-gray-800 group-hover/carousel:sm:flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1 no-scrollbar"
        >
          {topStores.map((group, idx) => {
            const metrics = config.metricFn(group, items);
            const clusterLabel = group.cluster ? CLUSTER_LABEL[group.cluster] ?? group.cluster : null;
            return (
              <button
                key={group.key}
                onClick={() => onStoreClick(group.key)}
                className="w-[220px] shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-all hover:border-brand-300 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-500/50"
                style={{ animation: `exec-fade-slide-up 0.3s var(--ease-out) ${idx * 60}ms both` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{group.label}</span>
                  {clusterLabel && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      group.cluster === "A" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" :
                      group.cluster === "OUT" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" :
                      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    }`}>
                      {clusterLabel}
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">{metrics.primary}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{group.totalActions} acciones</span>
                  <span className="text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">{metrics.secondary}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Dynamic stats per filter ───────────────────────────────────────────────

function FilterStats({ items, filterType }: { items: ActionItemFull[]; filterType: ActionFilterType }) {
  const stats = useMemo(() => {
    const skus = new Set(items.map(i => i.sku)).size;
    const totalUnits = items.reduce((s, i) => s + i.suggestedUnits, 0);
    const totalImpact = items.reduce((s, i) => s + i.impactScore, 0);
    const stockouts = items.filter(i => i.risk === "critical" && i.category === "movement").length;
    const low = items.filter(i => i.risk === "low").length;
    const overstock = items.filter(i => i.risk === "overstock").length;
    const movements = items.filter(i => i.category === "movement").length;
    const lifecycle = items.filter(i => i.category === "lifecycle").length;
    const exits = items.filter(i => (i.cohortAgeDays ?? 0) >= 90 && i.category === "lifecycle").length;
    const avgAge = items.length > 0
      ? Math.round(items.reduce((s, i) => s + (i.cohortAgeDays ?? 0), 0) / items.length)
      : 0;
    const gapUnits = items.reduce((s, i) => s + i.gapUnits, 0);
    const stores = new Set(items.map(i => i.store)).size;
    const totalStock = items.reduce((s, i) => s + i.currentStock, 0);

    return { skus, totalUnits, totalImpact, stockouts, low, overstock, movements, lifecycle, exits, avgAge, gapUnits, stores, totalStock };
  }, [items]);

  const fmt = (n: number) => n.toLocaleString("es-PY");
  const fmtGs = (n: number) => {
    if (n >= 1e9) return `₲ ${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `₲ ${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `₲ ${(n / 1e3).toFixed(0)}K`;
    return `₲ ${n}`;
  };

  if (items.length === 0) return null;

  switch (filterType) {
    case "all":
      return (
        <div className="exec-anim-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Acciones" value={fmt(items.length)} sub={`${stats.skus} SKUs · ${stats.stores} tiendas`} />
          <StatCard label="Sin Stock" value={fmt(stats.stockouts)} sub="Requieren reposición urgente" variant={stats.stockouts > 0 ? "negative" : "neutral"} />
          <StatCard label="Intervenciones" value={fmt(stats.lifecycle)} sub={stats.exits > 0 ? `${stats.exits} salida obligatoria` : "Decisión comercial"} variant={stats.lifecycle > 0 ? "accent-negative" : "neutral"} />
          <StatCard label="Impacto" value={fmtGs(stats.totalImpact)} sub={`${fmt(stats.totalUnits)} unidades a mover`} />
        </div>
      );

    case "reposition":
      return (
        <div className="exec-anim-2 grid grid-cols-3 gap-3">
          <StatCard label="Reposiciones" value={fmt(items.length)} sub={`${stats.skus} SKUs · ${stats.stores} tiendas`} />
          <StatCard label="Sin Stock" value={fmt(stats.stockouts)} sub="0 unidades en tienda" variant={stats.stockouts > 0 ? "negative" : "neutral"} />
          <StatCard label="Unidades" value={fmt(stats.totalUnits)} sub={stats.gapUnits > 0 ? `${fmt(stats.gapUnits)} gap pendiente` : "A recibir"} />
        </div>
      );

    case "redistribute":
      return (
        <div className="exec-anim-2 grid grid-cols-3 gap-3">
          <StatCard label="Redistribuciones" value={fmt(items.length)} sub={`${stats.skus} SKUs · ${stats.stores} tiendas`} />
          <StatCard label="Sobrestock" value={fmt(stats.overstock)} sub="SKUs sobre cobertura objetivo" />
          <StatCard label="Unidades" value={fmt(stats.totalUnits)} sub={`Impacto ${fmtGs(stats.totalImpact)}`} />
        </div>
      );

    case "size_curve":
      return (
        <div className="exec-anim-2 grid grid-cols-3 gap-3">
          <StatCard label="Curvas Rotas" value={fmt(items.length)} sub={`${stats.skus} SKUs afectados`} />
          <StatCard label="Tiendas" value={fmt(stats.stores)} sub="Con curvas incompletas" />
          <StatCard label="Tallas Faltantes" value={fmt(items.reduce((s, i) => s + (i.sourcableSizes?.length ?? 0), 0))} sub="Disponibles en la red" />
        </div>
      );

    case "lifecycle":
      return (
        <div className="exec-anim-2 grid grid-cols-3 gap-3">
          <StatCard label="Intervenciones" value={fmt(items.length)} sub={`${stats.skus} SKUs · ${stats.stores} tiendas`} variant="accent-negative" />
          <StatCard label="Edad Promedio" value={`${stats.avgAge}d`} sub="Desde ingreso a la red" variant={stats.avgAge > 45 ? "accent-negative" : "neutral"} />
          <StatCard label="Stock Retenido" value={`${fmt(stats.totalStock)}u`} sub={`Impacto ${fmtGs(stats.totalImpact)}`} />
        </div>
      );

    case "exit":
      return (
        <div className="exec-anim-2 grid grid-cols-3 gap-3">
          <StatCard label="Salida Obligatoria" value={fmt(items.length)} sub={`${stats.skus} SKUs · ${stats.stores} tiendas`} variant="negative" />
          <StatCard label="Edad Promedio" value={`${stats.avgAge}d`} sub="Pasados del límite 90d" variant="accent-negative" />
          <StatCard label="Unidades" value={`${fmt(stats.totalStock)}u`} sub={`Impacto ${fmtGs(stats.totalImpact)}`} />
        </div>
      );
  }
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

function PriorityIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
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
