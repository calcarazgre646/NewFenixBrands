/**
 * domain/freshness/classify.ts
 *
 * Funciones puras para clasificar freshness de materialized views.
 * Sin React, sin I/O.
 */
import type { FreshnessStatus, FreshnessThresholds } from "./types";

// ─── Thresholds por fuente ──────────────────────────────────────────────────

/** Umbrales por MV. Ventas: 90/180 min. DOI: 120/360 min. */
export const SOURCE_THRESHOLDS: Record<string, FreshnessThresholds> = {
  mv_ventas_mensual:            { staleMinutes: 90,  riskMinutes: 180 },
  mv_ventas_diarias:            { staleMinutes: 90,  riskMinutes: 180 },
  mv_ventas_12m_por_tienda_sku: { staleMinutes: 90,  riskMinutes: 180 },
  mv_stock_tienda:              { staleMinutes: 90,  riskMinutes: 180 },
  mv_doi_edad:                  { staleMinutes: 120, riskMinutes: 360 },
};

const DEFAULT_THRESHOLDS: FreshnessThresholds = { staleMinutes: 120, riskMinutes: 360 };

// ─── Clasificación ──────────────────────────────────────────────────────────

/**
 * Clasifica la frescura de un dato según la antigüedad de su refresh.
 *
 * - `ok`:    refreshedAt dentro de staleMinutes
 * - `stale`: refreshedAt entre staleMinutes y riskMinutes
 * - `risk`:  refreshedAt más allá de riskMinutes
 *
 * Timestamps futuros (clock skew) → 'ok'.
 */
export function classifyFreshness(
  refreshedAt: Date,
  now: Date,
  thresholds?: FreshnessThresholds,
): FreshnessStatus {
  const t = thresholds ?? DEFAULT_THRESHOLDS;
  const diffMs = now.getTime() - refreshedAt.getTime();
  if (diffMs < 0) return "ok";
  const diffMin = diffMs / 60_000;
  if (diffMin <= t.staleMinutes) return "ok";
  if (diffMin <= t.riskMinutes) return "stale";
  return "risk";
}

/** Retorna los umbrales para una fuente, con fallback a defaults. */
export function getThresholds(source: string): FreshnessThresholds {
  return SOURCE_THRESHOLDS[source] ?? DEFAULT_THRESHOLDS;
}

// ─── Relative time ──────────────────────────────────────────────────────────

/**
 * Formatea la diferencia entre una fecha y ahora como texto relativo.
 * Ej: "hace 5 min", "hace 2 h", "hace 1 día".
 */
export function formatRelativeTime(date: Date, now?: Date): string {
  const ref = now ?? new Date();
  const diffMs = ref.getTime() - date.getTime();
  if (diffMs < 0) return "ahora";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days > 1 ? "s" : ""}`;
}
