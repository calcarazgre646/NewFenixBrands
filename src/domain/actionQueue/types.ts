/**
 * domain/actionQueue/types.ts
 *
 * Tipos del dominio de Cola de Acciones.
 * El algoritmo de waterfall opera sobre estos tipos.
 */

/** Niveles del algoritmo waterfall (Spec de Rodrigo, 03/03/2026) */
export type WaterfallLevel =
  | "store_to_store"    // N1: Tienda ↔ Tienda (rebalanceo lateral)
  | "depot_to_store"    // N2: RETAILS depot → Tienda
  | "central_to_depot"  // N3: STOCK central → RETAILS depot
  | "central_to_b2b";   // N4: STOCK central → B2B directo

/** Tipo de acción recomendada */
export type ActionType =
  | "transfer"          // Transferencia entre tiendas
  | "restock_from_depot"   // Reposición desde depósito
  | "resupply_depot"    // Resurtir depósito desde central
  | "central_to_b2b";  // Envío directo a canal mayorista

/** Clasificación de riesgo */
export type RiskLevel = "critical" | "low" | "balanced" | "overstock";

/** Cluster de tienda (A=premium, B=standard, OUT=outlet) */
export type StoreCluster = "A" | "B" | "OUT";

/** Item de acción generado por el algoritmo */
export interface ActionItem {
  id:              string;      // uuid generado
  sku:             string;
  talle:           string;
  description:     string;
  brand:           string;
  store:           string;      // tienda origen/destino
  targetStore?:    string;      // tienda destino (solo store_to_store)
  currentStock:    number;
  suggestedUnits:  number;
  historicalAvg:   number;      // promedio mensual 12m
  coverMonths:     number;      // meses de cobertura objetivo
  risk:            RiskLevel;
  waterfallLevel:  WaterfallLevel;
  actionType:      ActionType;
  impactScore:     number;      // revenue × (1 + margin × 0.3)
  paretoFlag:      boolean;     // top 20% del impacto financiero
  storeCluster:    StoreCluster | null;
  timeRestriction: string;      // horario de la tienda
  bestDay:         string;      // mejor día de venta histórico
}

/** Input del algoritmo waterfall */
export interface WaterfallInput {
  inventory:    InventoryRecord[];
  salesHistory: Map<string, number>;  // key: "store|sku" → avg units/month
  bestDayMap:   Map<string, string>;  // key: store → "Martes", "Miércoles", etc.
}

/** Fila de inventario que consume el algoritmo */
export interface InventoryRecord {
  sku:         string;
  talle:       string;
  description: string;
  brand:       string;
  store:       string;
  storeCluster: StoreCluster | null;
  channel:     "b2c" | "b2b";
  units:       number;
  price:       number;
  cost:        number;
  linea:       string;  // agrupacion amplia: Camiseria, Vaqueria...
  categoria:   string;  // tipo especifico: camisa, jean, bermuda...
}

/** Config del algoritmo */
export interface WaterfallConfig {
  /** Meses de cobertura para marcas importadas (Wrangler, Lee → 6 meses) */
  coverMonthsImported: number;
  /** Meses de cobertura para marcas nacionales (Martel → 3 meses) */
  coverMonthsNational: number;
}

export const DEFAULT_WATERFALL_CONFIG: WaterfallConfig = {
  coverMonthsImported: 6,   // 180 días — lead time importación
  coverMonthsNational: 3,   // 90 días — lead time nacional
};
