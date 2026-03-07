/**
 * domain/kpis/types.ts
 *
 * Tipos del dominio de KPIs.
 * Estas interfaces son la capa de contrato entre la lógica de negocio y la UI.
 */

export type KpiStatus = "ok" | "warning" | "pending" | "error";
export type KpiPriority = "critical" | "high" | "medium" | "low";
export type KpiCategory =
  | "sales"
  | "profit"
  | "inventory"
  | "store"
  | "product"
  | "customer"
  | "logistics"
  | "commercial"
  | "finance";

export type KpiTrend = "up" | "down" | "neutral";

/** Definición estática de un KPI (no cambia con datos) */
export interface KpiDefinition {
  id:          string;
  name:        string;
  description: string;
  category:    KpiCategory;
  priority:    KpiPriority;
  unit:        "currency" | "percent" | "number" | "ratio" | "days";
  /** Dirección positiva: si el valor sube, ¿es bueno? */
  positiveDirection: "up" | "down";
  /** Benchmark de referencia (si existe) */
  benchmark?: {
    value:       number;
    description: string;
  };
  /** Es un KPI live (datos reales de BD) o mock */
  dataSource: "live" | "mock";
}

/** Punto en una serie histórica */
export interface SeriesPoint {
  month:  number;
  year:   number;
  label:  string;   // "Ene", "Feb", etc.
  value:  number;
}

/** Historial de un KPI para graficar */
export interface KpiHistory {
  kpiId:          string;
  currentSeries:  SeriesPoint[];
  priorYearSeries?: SeriesPoint[];
  budgetSeries?:  SeriesPoint[];
}

/** Valor actual de un KPI (para cards y grids) */
export interface KpiValue {
  kpiId:          string;
  value:          number;
  previousValue?: number;    // valor comparación (año anterior o presupuesto)
  change?:        number;    // variación % o absoluta
  trend?:         KpiTrend;
  status:         KpiStatus;
  label:          string;   // Label del período
  isLive:         boolean;
  cachedAt?:      Date;
}

/** KPI completo = definición + valor */
export interface Kpi {
  definition: KpiDefinition;
  value:      KpiValue | null;
}
