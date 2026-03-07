/**
 * domain/filters/types.ts
 *
 * Tipos canónicos para el sistema de filtros de la app.
 *
 * REGLA: Todos los filtros de la app pasan por estos tipos.
 * No hay strings mágicos "total"/"b2c"/"b2b" dispersos en el código —
 * todo se valida aquí a nivel de tipo TypeScript.
 */

/** Filtro de marca. "total" = todas las marcas sin filtrar */
export type BrandFilter = "total" | "martel" | "wrangler" | "lee";

/** Filtro de canal de venta. "total" = todos los canales */
export type ChannelFilter = "total" | "b2b" | "b2c";

/**
 * Período de análisis.
 * - ytd:              Año a la fecha (solo meses cerrados)
 * - lastClosedMonth:  Último mes completamente cerrado
 * - currentMonth:     Mes calendario actual (puede tener datos parciales)
 */
export type PeriodFilter = "ytd" | "lastClosedMonth" | "currentMonth";

/**
 * Estado completo de filtros de la app.
 * Este es el shape que viaja desde FilterContext a todos los hooks.
 */
export interface AppFilters {
  brand:   BrandFilter;
  channel: ChannelFilter;
  /** Código de tienda (cosujd limpio). null = todas las tiendas */
  store:   string | null;
  period:  PeriodFilter;
  /** Año de análisis. Default: año calendario actual */
  year:    number;
}

/** Valores por defecto de filtros al iniciar la app */
export const DEFAULT_FILTERS: AppFilters = {
  brand:   "total",
  channel: "total",
  store:   null,
  period:  "ytd",
  year:    new Date().getFullYear(),
};
