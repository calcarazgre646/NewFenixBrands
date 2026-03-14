/**
 * domain/depots/types.ts
 *
 * Tipos del dominio de Depósitos & Cobertura.
 * Modela la cadena operativa: STOCK → RETAILS → Red Retail (tiendas B2C).
 */

/** Clasificación de riesgo por semanas de cobertura (WOI) */
export type DepotRisk = "critico" | "bajo" | "saludable" | "alto" | "sin_venta";

/** Desglose por marca o categoría dentro de un nodo */
export interface GroupBreakdown {
  label: string;
  units: number;
  value: number;
  /** WOI del grupo (semanas). null si no hay ventas históricas. */
  woi:   number | null;
}

/** Fila de SKU con métricas de cobertura */
export interface DepotSkuRow {
  store:           string;
  sku:             string;
  skuComercial:    string;
  talle:           string;
  description:     string;
  brand:           string;
  categoria:       string;
  estado:          string;
  carryOver:       boolean;
  units:           number;
  value:           number;
  avgMonthlySales: number;
  weeklySales:     number;
  weeksOnHand:     number | null;   // null = sin ventas históricas
}

/** Nodo central (STOCK o RETAILS) */
export interface CentralNode {
  key:             string;
  label:           string;
  subtitle:        string;
  type:            "central";
  units:           number;
  value:           number;
  monthlyDemand:   number;   // demanda mensual de la red dependiente
  weeklyDemand:    number;   // monthlyDemand / 4.33
  weeksOnHand:     number;   // units / weeklyDemand
  risk:            DepotRisk;
  skuCount:        number;
  topBrands:       GroupBreakdown[];
  topCategories:   GroupBreakdown[];
  topSkuRows:      DepotSkuRow[];
}

/** Tienda de la red retail */
export interface StoreNode {
  key:             string;
  label:           string;
  type:            "store";
  cluster:         import("@/domain/actionQueue/types").StoreCluster | null;
  units:           number;
  value:           number;
  monthlyDemand:   number;
  weeklyDemand:    number;
  weeksOnHand:     number;
  risk:            DepotRisk;
  skuCount:        number;
  topBrands:       GroupBreakdown[];
  topCategories:   GroupBreakdown[];
  skuRows:         DepotSkuRow[];
}

/** Totales de la red */
export interface NetworkTotals {
  dependentStoreCount: number;
  networkUnits:        number;
  networkValue:        number;
  networkMonthlyDemand: number;
  networkWeeklyDemand: number;
  criticalStoreCount:  number;
}

/** Ventana de ventas usada para el cálculo */
export interface SalesWindow {
  latestLabel:  string;       // "2026-03"
  periodLabels: string[];     // ["2025-10", "2025-11", ...]
}

/** Datos completos de la vista Depósitos */
export interface DepotData {
  salesWindow:     SalesWindow;
  scopeCandidates: string[];      // tiendas incluidas en análisis
  stock:           CentralNode;
  retails:         CentralNode;
  stores:          StoreNode[];
  topSkuRows:      DepotSkuRow[];
  totals:          NetworkTotals;
}
