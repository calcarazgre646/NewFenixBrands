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
 * Sub-filtro de B2B. Sólo aplica cuando channel === "b2b".
 *   - "all":       Mayorista + UTP (comportamiento previo, default)
 *   - "mayorista": sólo Venta x Mayor (`v_sucursal_final='MAYORISTA'` /
 *                  `v_uniforme='vtaxmayor'`)
 *   - "utp":       sólo Uniformes/UTP (`v_sucursal_final='UTP'` /
 *                  `v_uniforme='uniforme'`)
 *
 * Verificado en BD al 2026-04-28: B2B en mv_ventas_mensual sólo tiene
 * dos pseudo-sucursales (MAYORISTA y UTP). En fjdhstvta1 el cruce con
 * v_uniforme es 1:1 perfecto.
 *
 * Cuando channel ≠ "b2b" este campo se ignora (queda en "all"
 * silenciosamente; FilterContext lo resetea al cambiar canal).
 */
export type B2bSubchannel = "all" | "mayorista" | "utp";

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
  /** Sub-filtro B2B; sólo significativo cuando channel === "b2b" */
  b2bSubchannel: B2bSubchannel;
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
  b2bSubchannel: "all",
  store:   null,
  period:  "ytd",
  year:    new Date().getFullYear(),
};
