/**
 * domain/freshness/types.ts
 *
 * Tipos para el sistema de freshness de materialized views.
 */

/** Nombres que coinciden con data_freshness.source_name en la BD. */
export type FreshnessSource =
  | "mv_ventas_mensual"
  | "mv_ventas_diarias"
  | "mv_ventas_12m_por_tienda_sku"
  | "mv_stock_tienda"
  | "mv_doi_edad";

/** Estado semántico de frescura. */
export type FreshnessStatus = "ok" | "stale" | "risk" | "unknown";

/** Información completa de freshness para una fuente. */
export interface FreshnessInfo {
  source: FreshnessSource;
  refreshedAt: Date;
  rowCount: number | null;
  /** Status raw de la BD ('ok' o mensaje de error truncado). */
  dbStatus: string;
  /** Status computado comparando refreshedAt vs now. */
  computedStatus: FreshnessStatus;
}

/** Umbrales configurables para clasificar freshness. */
export interface FreshnessThresholds {
  /** Minutos hasta considerar stale. */
  staleMinutes: number;
  /** Minutos hasta considerar riesgo. */
  riskMinutes: number;
}
