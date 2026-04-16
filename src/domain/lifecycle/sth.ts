/**
 * domain/lifecycle/sth.ts
 *
 * Funciones puras para Sell-Through Rate y métricas derivadas.
 *
 * STH = Units Sold / Units Received (0-1 escala en BD, 0-100 para UI).
 * DOI derivado = Edad × (1 - STH) / STH (fórmula de Rodrigo).
 *
 * No React, no side effects.
 */

/**
 * Calcula STH (Sell-Through Rate) en escala 0-100.
 * @returns 0 si no hay unidades recibidas (evita NaN).
 */
export function calcSth(unitsSold: number, unitsReceived: number): number {
  if (unitsReceived <= 0) return 0;
  const ratio = unitsSold / unitsReceived;
  // Cap at 100% — can't sell more than received (data artifacts)
  return Math.min(ratio * 100, 100);
}

/**
 * Calcula la edad en días de un cohorte.
 * @returns 0 si firstEntry es null/undefined o en el futuro.
 */
export function calcCohortAge(firstEntry: Date | null, now: Date = new Date()): number {
  if (!firstEntry) return 0;
  const diff = now.getTime() - firstEntry.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Calcula DOI derivado desde STH (fórmula de Rodrigo).
 * DOI = age × (1 - STH) / STH
 *
 * Interpretación: cuántos días de cobertura quedan basado en la velocidad de venta.
 *
 * @param ageDays - Edad en días del cohorte
 * @param sth - STH en escala 0-100
 * @returns DOI en días. 0 si STH = 0 (no se puede calcular — inventario muerto).
 *          Infinity conceptual se capea a 9999 para evitar problemas numéricos.
 */
export function calcDoiFromSth(ageDays: number, sth: number): number {
  if (sth <= 0) return Math.min(ageDays * 100, 9999); // no ventas = DOI extremo
  if (sth >= 100) return 0; // todo vendido
  const sthRatio = sth / 100;
  return Math.min(Math.round(ageDays * (1 - sthRatio) / sthRatio), 9999);
}

/**
 * Lookup STH for a specific SKU+talle in a store.
 * Two-level: exact (store+sku+talle) → fallback (store+sku).
 *
 * @returns SthRecord or null if no data.
 */
export function lookupSth(
  sthData: { exact: Map<string, { sth: number; cohortAgeDays: number }>; byStoreSku: Map<string, { sth: number; cohortAgeDays: number }> } | undefined,
  store: string,
  sku: string,
  talle: string,
): { sth: number; cohortAgeDays: number } | null {
  if (!sthData) return null;
  const s = store.toUpperCase();
  return sthData.exact.get(`${s}|${sku}|${talle}`)
      ?? sthData.byStoreSku.get(`${s}|${sku}`)
      ?? null;
}
