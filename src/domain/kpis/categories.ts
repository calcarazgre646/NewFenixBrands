/**
 * domain/kpis/categories.ts
 *
 * Definición de las 9 categorías de negocio que agrupan los 50 KPIs.
 * Fuente: "KPI FENIX.xlsx" — contrato con el cliente.
 */
import type { KpiCategory } from "./types";
import { FENIX_KPI_CATALOG, type FenixKpiSpec, type FenixPst } from "./fenix.catalog";

// ─── Metadata de categorías ──────────────────────────────────────────────────

export interface CategoryMeta {
  id: KpiCategory;
  name: string;
  shortName: string;
  description: string;
  order: number;
}

export const KPI_CATEGORIES: Record<KpiCategory, CategoryMeta> = {
  sales: {
    id: "sales",
    name: "Ventas & Revenue Performance",
    shortName: "Ventas",
    description: "¿Cuánto vendemos y cómo evoluciona el core del negocio?",
    order: 1,
  },
  profit: {
    id: "profit",
    name: "Rentabilidad & Finanzas",
    shortName: "Rentabilidad",
    description: "¿Qué tan rentable es vender lo que vendemos?",
    order: 2,
  },
  inventory: {
    id: "inventory",
    name: "Inventario & Abastecimiento",
    shortName: "Inventario",
    description: "¿Cómo gestionamos stock, rotación y disponibilidad?",
    order: 3,
  },
  store: {
    id: "store",
    name: "Operaciones de Tienda & Fuerza de Venta",
    shortName: "Tienda",
    description: "¿Qué tan bien ejecuta el equipo en el punto de venta?",
    order: 4,
  },
  customer: {
    id: "customer",
    name: "Experiencia de Cliente & Fidelización",
    shortName: "Cliente",
    description: "¿Los clientes vuelven y nos eligen?",
    order: 5,
  },
  commercial: {
    id: "commercial",
    name: "Marketing & Comercial",
    shortName: "Marketing",
    description: "¿Qué tan eficiente es el gasto en marketing y la ejecución comercial?",
    order: 6,
  },
  product: {
    id: "product",
    name: "Producto, Pricing & Lanzamientos",
    shortName: "Producto",
    description: "¿Cómo lanzamos, predecimos y corregimos producto?",
    order: 7,
  },
  logistics: {
    id: "logistics",
    name: "Logística & Fulfillment",
    shortName: "Logística",
    description: "¿Cómo cumplimos con entregas y disponibilidad?",
    order: 8,
  },
  finance: {
    id: "finance",
    name: "Finanzas & Cobranzas",
    shortName: "Finanzas",
    description: "¿Cómo gestionamos el flujo de caja y cobranzas?",
    order: 9,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Categorías ordenadas por `order` */
export function getOrderedCategories(): CategoryMeta[] {
  return Object.values(KPI_CATEGORIES).sort((a, b) => a.order - b.order);
}

/** Categoría por ID */
export function getCategoryById(id: KpiCategory): CategoryMeta | undefined {
  return KPI_CATEGORIES[id];
}

/** KPIs de una categoría, del catálogo completo */
export function getKpisByCategory(categoryId: KpiCategory): readonly FenixKpiSpec[] {
  return FENIX_KPI_CATALOG.filter((k) => k.category === categoryId);
}

/** Cuenta KPIs por categoría */
export function getKpiCountByCategory(categoryId: KpiCategory): number {
  return FENIX_KPI_CATALOG.filter((k) => k.category === categoryId).length;
}

/** Label legible para el PST */
export function getPstLabel(pst: FenixPst): string {
  switch (pst) {
    case "core":    return "Disponible";
    case "next":    return "Fase 2";
    case "later":   return "Requiere Datos";
    case "future":  return "Sin Medición";
    case "blocked": return "Bloqueado";
  }
}

/** Color CSS para el badge de PST */
export function getPstBadgeClass(pst: FenixPst): string {
  switch (pst) {
    case "core":    return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400";
    case "next":    return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400";
    case "later":   return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
    case "future":  return "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
    case "blocked": return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
  }
}
