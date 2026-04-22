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
 * @contract division-by-zero
 *   Si el precio (PVP o PVM) es ≤ 0, retorna 0. Nunca Infinity ni NaN.
 *
 * @contract negative-margin
 *   Si costo > precio, el margen es NEGATIVO (dato válido: venta a pérdida).
 *   No se clampea a 0.
 */

// Reutiliza el check de Novedad del feature Depósitos (fuente canónica).
// Se re-exporta para que consumidores de Pricing tengan un único import.
export { isNovelty } from "@/domain/depots/calculations";

/**
 * Margen Bruto sobre Precio de Venta al Público (retail).
 * MBP% = (PVP − Costo) / PVP × 100
 */
export function calcMBP(pvp: number, costo: number): number {
  if (pvp <= 0) return 0;
  return ((pvp - costo) / pvp) * 100;
}

/**
 * Margen Bruto sobre Precio de Venta Mayorista.
 * MBM% = (PVM − Costo) / PVM × 100
 */
export function calcMBM(pvm: number, costo: number): number {
  if (pvm <= 0) return 0;
  return ((pvm - costo) / pvm) * 100;
}

/** Estado de promoción / markdown de un SKU. */
export interface PromotionStatus {
  /** ¿El SKU tiene una promoción activa? */
  active: boolean;
  /** Porcentaje de descuento aplicado (0-100). */
  markdownPct: number;
}

/**
 * Estado de promoción de un SKU.
 *
 * TODO: pendiente definición de cliente (Rodrigo/Derlys).
 * No hay fuente de datos todavía. Opciones posibles:
 *   - Campo nuevo en dim_maestro_comercial (flag promo + %)
 *   - Comparar precio actual vs histórico para inferir markdown
 *   - Tabla/vista "promociones" con vigencia por SKU
 *
 * Hasta definir criterio: retorna estado neutro (sin promo).
 */
export function getPromotionStatus(_sku: string): PromotionStatus {
  return { active: false, markdownPct: 0 };
}
