/**
 * domain/filters/viewSupport.ts
 *
 * Contrato declarativo: qué filtros globales (brand/canal/período) tiene
 * sentido aplicar en cada vista.
 *
 * REGLA DE UX: Los 3 filtros aparecen SIEMPRE en el mismo orden y posición
 * en cada vista que los usa. Cuando un filtro no aplica matemáticamente, se
 * muestra deshabilitado con un tooltip explicativo — nunca se oculta — para
 * que el usuario tenga la misma referencia visual entre vistas.
 *
 * Vistas sin filtros (/usuarios, /calendario, /ayuda) simplemente no
 * renderizan `<GlobalFilters>` y no aparece la barra.
 */

/**
 * Por filtro: `true` = soportado; `false` = no soportado (tooltip default);
 * `string` = no soportado con tooltip explicativo custom.
 */
export type FilterSupport = boolean | string;

export interface ViewFilterSupport {
  brand:   FilterSupport;
  channel: FilterSupport;
  period:  FilterSupport;
}

/** Atajo: vista con los 3 filtros habilitados sin restricciones. */
export const ALL_FILTERS_ENABLED: ViewFilterSupport = {
  brand:   true,
  channel: true,
  period:  true,
};

/**
 * Tooltips estándar reutilizables. Cuando una limitación se repite entre
 * vistas (por ej. "no aplica a comisiones"), declararla acá para que el
 * mensaje quede consistente.
 */
export const FILTER_REASONS = {
  /** Logística/Depósitos: las llegadas y stock físico no se segmentan por canal. */
  noChannelInventory:
    "Este módulo no se segmenta por canal: stock físico es transversal.",
  /** Logística: las llegadas son ETAs vigentes; no se filtran por período histórico. */
  noPeriodLogistics:
    "Logística muestra llegadas vigentes (ETAs futuras y pasadas): no aplica filtro de período.",
  /** Depósitos: el stock es snapshot a hoy, no histórico. */
  noPeriodDepots:
    "Depósitos muestra stock actual: no aplica filtro de período.",
  /** Pricing: la ficha de precios es un snapshot, sin lente temporal. */
  noPeriodSnapshot:
    "Precios es un snapshot del catálogo: no aplica filtro de período.",
  /** Pricing: la ficha de precios no varía por canal de venta. */
  noChannelPricing:
    "Precios se muestra a nivel SKU comercial (PVP, PVM): no segmenta por canal.",
} as const;

/**
 * Devuelve el tooltip a mostrar para un filtro deshabilitado.
 * Si `support === false` sin razón, usa un mensaje genérico.
 */
export function disabledReason(support: FilterSupport): string | null {
  if (support === true) return null;
  if (typeof support === "string") return support;
  return "Este filtro no aplica en esta vista.";
}

/** ¿El filtro está habilitado? */
export function isEnabled(support: FilterSupport): boolean {
  return support === true;
}
