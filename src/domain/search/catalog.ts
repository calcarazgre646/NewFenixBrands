/**
 * domain/search/catalog.ts
 *
 * Genera el catálogo de items buscables a partir de las fuentes de datos del proyecto.
 * Cada fuente (KPIs, páginas, acciones) se transforma a SearchableItem[].
 *
 * Solo se indexan KPIs con pst="core" (implementados). Los demás no son
 * navegables ni relevantes para el usuario en producción.
 *
 * Este archivo NO tiene dependencias de React — se puede importar en tests y hooks.
 */
import { FENIX_KPI_CATALOG } from "@/domain/kpis/fenix.catalog";
import type { SearchableItem } from "./types";

// ─── KPI Category labels ──────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Ventas",
  profit: "Rentabilidad",
  inventory: "Inventario",
  store: "Tienda",
  product: "Producto",
  customer: "Cliente",
  logistics: "Logística",
  commercial: "Comercial",
  finance: "Finanzas",
};

// ─── System pages ─────────────────────────────────────────────────────────────

const SYSTEM_PAGES: SearchableItem[] = [
  {
    type: "page",
    id: "page_home",
    title: "Inicio",
    subtitle: "Road to Annual Target — visión consolidada del año",
    searchableText: "dashboard ejecutivo home principal",
    path: "/",
    meta: { icon: "bolt" },
  },
  {
    type: "page",
    id: "page_sales",
    title: "Ventas",
    subtitle: "Análisis de ventas por período, marca, canal y tienda",
    searchableText: "ventas revenue ingresos facturación sales",
    path: "/ventas",
    meta: { icon: "dollar-line" },
  },
  {
    type: "page",
    id: "page_actions",
    title: "Centro de Acciones",
    subtitle: "Cola de acciones priorizadas por algoritmo waterfall",
    searchableText: "acciones reposicion stock inventario waterfall pareto",
    path: "/acciones",
    meta: { icon: "list" },
  },
  {
    type: "page",
    id: "page_logistics",
    title: "Logística",
    subtitle: "Embarques de importación, fechas de arribo, tracking",
    searchableText: "logistica importaciones embarques eta llegadas import",
    path: "/logistica",
    meta: { icon: "box" },
  },
  {
    type: "page",
    id: "page_calendar",
    title: "Calendario",
    subtitle: "Calendario comercial con eventos, campañas y showrooms",
    searchableText: "calendario eventos campañas showrooms fechas",
    path: "/calendario",
    meta: { icon: "calender-line" },
  },
];

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS: SearchableItem[] = [
  {
    type: "action",
    id: "action_theme",
    title: "Cambiar tema",
    subtitle: "Alternar entre modo claro y oscuro",
    searchableText: "tema theme dark light oscuro claro",
    path: "__action:toggle-theme",
  },
];

// ─── Build catalog ────────────────────────────────────────────────────────────

/** Transforma KPIs core (implementados) a items buscables — sin path (solo informativo) */
function buildKpiItems(): SearchableItem[] {
  return FENIX_KPI_CATALOG
    .filter((kpi) => kpi.pst === "core")
    .map((kpi) => ({
      type: "kpi" as const,
      id: `kpi_${kpi.id}`,
      title: kpi.name,
      subtitle: kpi.definition,
      searchableText: [
        kpi.formula,
        kpi.id,
        kpi.obs ?? "",
        CATEGORY_LABELS[kpi.category] ?? kpi.category,
      ].join(" "),
      meta: {
        category: CATEGORY_LABELS[kpi.category] ?? kpi.category,
        kpiId: kpi.id,
      },
    }));
}

/**
 * Retorna el catálogo completo de items buscables.
 * Resultado estable — puede memoizarse en el hook.
 */
export function buildSearchCatalog(): SearchableItem[] {
  return [...SYSTEM_PAGES, ...buildKpiItems(), ...QUICK_ACTIONS];
}
