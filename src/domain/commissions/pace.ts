/**
 * domain/commissions/pace.ts
 *
 * Helpers puros para visualizar la curva escalonada de comisiones (staircase)
 * y la posición del vendedor en ella. Usados por StaircaseCommissionCurve y
 * PaceChart en la UI.
 *
 * REGLA: Sin I/O, sin React. Solo derivaciones puras a partir de
 * CommissionScale + cumplimiento + meta.
 */
import type { CommissionScale, CommissionTier } from "./types";

// ─── Tipos públicos ────────────────────────────────────────────────────────

export type PaceBand = "behind" | "on-track" | "ahead";

export interface NextTierInfo {
  /** El tramo al que apunta el vendedor. null si ya está en el último. */
  nextTier: CommissionTier | null;
  /** Puntos % de cumplimiento que faltan para alcanzar el siguiente tramo. 0 si ya está. */
  pctNeeded: number;
  /** Gs. de venta adicionales necesarios para alcanzar el siguiente tramo. 0 si meta inválida. */
  ventasNeeded: number;
}

export interface StaircasePoint {
  /** % de cumplimiento (eje X). */
  cumplimientoPct: number;
  /** Valor del tramo (eje Y) — % de comisión o monto fijo según `scale.type`. */
  value: number;
}

// ─── Bandas semánticas ──────────────────────────────────────────────────────

/**
 * Retorna la banda de pace para un % de cumplimiento.
 * - behind: < 80%
 * - on-track: 80–100%
 * - ahead: ≥ 100%
 */
export function getPaceBand(cumplimientoPct: number): PaceBand {
  if (cumplimientoPct < 80) return "behind";
  if (cumplimientoPct < 100) return "on-track";
  return "ahead";
}

// ─── Próximo tramo ─────────────────────────────────────────────────────────

/**
 * Encuentra el primer tramo cuya `minPct` es estrictamente mayor que el
 * cumplimiento actual. Es decir, el tramo inmediatamente siguiente al actual.
 */
export function getNextTier(
  scale: CommissionScale,
  cumplimientoPct: number,
): CommissionTier | null {
  for (const tier of scale.tiers) {
    if (tier.minPct > cumplimientoPct) return tier;
  }
  return null;
}

/**
 * Calcula cuánto le falta al vendedor para subir al siguiente tramo:
 * puntos % y Gs. de venta. Retorna 0 si ya está en el último tramo o si
 * la meta no es válida.
 */
export function getDeltaToNextTier(
  scale: CommissionScale,
  ventaActual: number,
  meta: number,
): NextTierInfo {
  const cumplimientoPct = meta > 0 ? (ventaActual / meta) * 100 : 0;
  const nextTier = getNextTier(scale, cumplimientoPct);

  if (!nextTier) {
    return { nextTier: null, pctNeeded: 0, ventasNeeded: 0 };
  }

  const pctNeeded = nextTier.minPct - cumplimientoPct;
  const ventasNeeded = meta > 0 ? Math.max(0, Math.ceil(meta * (pctNeeded / 100))) : 0;

  return {
    nextTier,
    pctNeeded: Math.max(0, pctNeeded),
    ventasNeeded,
  };
}

// ─── Curva staircase ───────────────────────────────────────────────────────

/**
 * Genera puntos para dibujar la curva staircase (step-after) de una escala.
 *
 * Para cada tramo emite dos puntos: el inicio (minPct, value) y el fin
 * (maxPct, value), permitiendo a la librería de chart trazar líneas
 * horizontales con saltos verticales. El último tramo (maxPct = Infinity) se
 * cierra en `xMax` (default 150% de cumplimiento).
 */
export function buildStaircasePoints(
  scale: CommissionScale,
  xMax = 150,
): StaircasePoint[] {
  const points: StaircasePoint[] = [];
  for (const tier of scale.tiers) {
    points.push({ cumplimientoPct: tier.minPct, value: tier.value });
    const end = Number.isFinite(tier.maxPct) ? tier.maxPct : xMax;
    points.push({ cumplimientoPct: end, value: tier.value });
  }
  return points;
}
