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
  sku:             string;      // SKU técnico ERP (ej: "7031457")
  skuComercial:    string;      // SKU Comercial de Dim_maestro_comercial (ej: "MACA004428")
  talle:           string;
  description:     string;
  brand:           string;
  store:           string;      // tienda origen/destino
  targetStore?:    string;      // tienda destino (solo store_to_store)
  currentStock:    number;
  suggestedUnits:  number;
  idealUnits:      number;      // unidades necesarias para llegar al target (sin restricción de disponibilidad)
  gapUnits:        number;      // idealUnits - suggestedUnits = demanda insatisfecha → señal de compra
  daysOfInventory: number;      // DOI-edad = días desde último movimiento de stock a esta ubicación
  historicalAvg:   number;      // promedio mensual 6m (spec cliente)
  coverWeeks:      number;      // semanas de cobertura objetivo (12=nacional, 24=importado)
  currentMOS:      number;      // Months of Stock actual = stock / avg monthly sales
  risk:            RiskLevel;
  waterfallLevel:  WaterfallLevel;
  actionType:      ActionType;
  impactScore:     number;      // revenue × (1 + margin × 0.3)
  paretoFlag:      boolean;     // top 20% del impacto financiero
  storeCluster:    StoreCluster | null;
  timeRestriction: string;      // horario de la tienda
}

/** Input del algoritmo waterfall */
export interface WaterfallInput {
  inventory:    InventoryRecord[];
  salesHistory: Map<string, number>;  // key: "store|sku" → avg units/month
  doiAge?:      { exact: Map<string, number>; byStoreSku: Map<string, number> };
}

/** Fila de inventario que consume el algoritmo */
export interface InventoryRecord {
  sku:         string;      // SKU técnico ERP
  skuComercial: string;     // SKU Comercial (Dim_maestro_comercial)
  talle:       string;
  description: string;
  brand:       string;
  store:       string;
  storeCluster: StoreCluster | null;
  channel:     "b2c" | "b2b";
  units:       number;
  price:       number;
  priceMay:    number;      // precio mayorista (para impacto B2B)
  cost:        number;
  linea:       string;  // agrupacion amplia: Camiseria, Vaqueria...
  categoria:   string;  // tipo especifico: camisa, jean, bermuda...
}

