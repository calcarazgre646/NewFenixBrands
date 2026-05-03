/**
 * domain/pricing/calculations.ts
 *
 * Funciones PURAS de cálculo para la vista de Precios.
 * Sin React. Sin Supabase. Sin efectos secundarios.
 *
 * ─── CONTRATOS ──────────────────────────────────────────────────────────────
 *
 * @contract percentages
 *   Márgenes en escala 0-100 (no 0-1). Ej: 40% = 40.
 *
 * @contract erp-placeholder
 *   El ERP usa precios `0` y `1` como placeholder de "sin precio asignado".
 *   Cualquier precio < MIN_VALID_PRICE se trata como ausencia de dato y
 *   `calcMBP`/`calcMBM` retornan 0 (la UI debe mostrar "—" en ese caso).
 *   Verificado contra `mv_stock_tienda`: ej. SKU WRCA009862 tiene 6 filas
 *   con pvp=320000 y 1 fila con pvp=1 — sin este guard, esa fila produce
 *   MBP de -17 millones de % y arrastra los promedios.
 *
 * @contract negative-margin
 *   Si costo > precio (siendo precio un valor real ≥ MIN_VALID_PRICE),
 *   el margen es NEGATIVO (dato válido: venta a pérdida). No se clampea.
 */

/**
 * Umbral por debajo del cual un precio se considera placeholder ERP, no
 * un precio real. En guaraníes — cualquier producto real cuesta mucho más
 * que 10 Gs.
 */
export const MIN_VALID_PRICE = 10;

// Reutiliza el check de Novedad del feature Depósitos (fuente canónica).
// Se re-exporta para que consumidores de Pricing tengan un único import.
export { isNovelty } from "@/domain/depots/calculations";

/**
 * Margen Bruto sobre Precio de Venta al Público (retail).
 * MBP% = (PVP − Costo) / PVP × 100
 */
export function calcMBP(pvp: number, costo: number): number {
  if (pvp < MIN_VALID_PRICE) return 0;
  return ((pvp - costo) / pvp) * 100;
}

/**
 * Margen Bruto sobre Precio de Venta Mayorista.
 * MBM% = (PVM − Costo) / PVM × 100
 */
export function calcMBM(pvm: number, costo: number): number {
  if (pvm < MIN_VALID_PRICE) return 0;
  return ((pvm - costo) / pvm) * 100;
}

/** Estado de promoción / markdown de un SKU. */
export interface PromotionStatus {
  /** ¿El SKU tiene una promoción activa? */
  active: boolean;
  /** Porcentaje de descuento aplicado (0-100). */
  markdownPct: number;
}

/** Estado neutro — usado cuando un SKU no tiene markdown cargado. */
export const NO_PROMOTION: PromotionStatus = { active: false, markdownPct: 0 };
