/**
 * domain/actionQueue/types.ts
 *
 * Tipos del dominio de Cola de Acciones.
 * El algoritmo de waterfall opera sobre estos tipos.
 */
import type { WaterfallConfig } from "@/domain/config/types";
import type { ProductType, LifecycleAction, ResponsibleRole, LinealidadResult } from "@/domain/lifecycle/types";
import type { DecisionOutcome } from "@/domain/lifecycle/sequentialDecision";

/** Niveles del algoritmo waterfall (Spec de Rodrigo, 03/03/2026) */
export type WaterfallLevel =
  | "store_to_store"    // N1: Tienda ↔ Tienda (rebalanceo lateral)
  | "depot_to_store"    // N2: RETAILS depot → Tienda
  | "central_to_depot"  // N3: STOCK central → RETAILS depot
  | "central_to_b2b";   // N4: STOCK central → B2B directo

/** Tipo de acción recomendada */
export type ActionType =
  // Movement actions (waterfall N1-N4)
  | "transfer"             // Transferencia entre tiendas
  | "restock_from_depot"   // Reposición desde depósito
  | "resupply_depot"       // Resurtir depósito desde central
  | "central_to_b2b"      // Envío directo a canal mayorista
  // Lifecycle actions (post-processing)
  | "revisar_exhibicion"       // 15d: revisar exhibición en tienda
  | "revisar_asignacion"       // 30d: revisar asignación de tienda
  | "accion_comercial"         // 45d: acción comercial y marketing
  | "markdown_selectivo"       // 60d: markdown selectivo
  | "transferencia_lifecycle"     // A→B: transferencia lifecycle entre clusters
  | "transferencia_out_lifecycle" // B→OUT: transferencia OUT + markdown progresivo
  | "markdown_liquidacion"    // 90d: markdown liquidación
  // Sequential analysis actions
  | "reposicion_tallas"       // Completar curva de tallas desde otras tiendas
  | "consolidar_curva";       // Consolidar tallas en esta tienda

/** Categoría de acción: movimiento de stock vs intervención de lifecycle */
export type ActionCategory = "movement" | "lifecycle";

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
  /** @deprecated Always false — prioritization is now risk-based, not Pareto. Kept for persistence compatibility. */
  paretoFlag:      boolean;
  storeCluster:    StoreCluster | null;
  timeRestriction: string;      // horario de la tienda
  productType:     ProductType; // clasificación lifecycle (carry_over | basicos | temporada)
  category:        ActionCategory; // "movement" (waterfall) | "lifecycle" (post-processing)
  responsibleRoles: ResponsibleRole[]; // roles que deben ejecutar esta acción
  lifecycleAction?: LifecycleAction;   // tipo de intervención lifecycle (si aplica)
  lifecycleEvaluation?: LinealidadResult; // evaluación completa de linealidad (si aplica)
  sth?:            number;      // sell-through rate 0-100 (from mv_sth_cohort, optional)
  cohortAgeDays?:  number;      // days since first entry to network (from mv_sth_cohort, optional)
  skuAvgSthInStore?: number;    // STH promedio del SKU (todas sus tallas) en esta tienda (0-100). Contexto para acciones lifecycle per-talla.
  sequentialOutcome?: DecisionOutcome; // resultado del análisis secuencial (debugging/UI)
  sizeCurveCoverage?: number;   // % de curva de tallas cubierta en esta tienda
  sourcableSizes?: string[];    // tallas faltantes disponibles en otras tiendas
  presentSizes?: string[];      // tallas presentes en la tienda para este SKU
  networkSizes?: string[];      // todas las tallas conocidas en la red para este SKU
  sizeUnits?: Record<string, number>; // unidades por talla en esta tienda { "S": 3, "M": 0, "L": 5 }
}

/**
 * Tipo de salida no-venta (Rule 9 — Rodrigo 09/04/2026).
 * NOTA: El ERP (movimientos_st_jde) NO distingue estos tipos actualmente.
 * Todos los movimientos son tipo_doc "ST" (Stock Transfer).
 * Esta estructura está preparada para cuando Fenix provea el dato.
 */
export type ExitReason = "venta" | "merma" | "devolucion" | "cambio";

/** Opciones del algoritmo waterfall (todo excepto input es opcional con defaults) */
export interface ComputeActionQueueOptions {
  mode: "b2c" | "b2b";
  brandFilter?: string | null;
  lineaFilter?: string | null;
  categoriaFilter?: string | null;
  storeFilter?: string | null;
  impactThreshold?: number;
  storeClusters?: Record<string, StoreCluster>;
  storeTimeRestrictions?: Record<string, string>;
  waterfallConfig?: WaterfallConfig;
}

/** Input del algoritmo waterfall */
export interface WaterfallInput {
  inventory:    InventoryRecord[];
  salesHistory: Map<string, number>;  // key: "store|sku" → avg units/month
  doiAge?:      { exact: Map<string, number>; byStoreSku: Map<string, number> };
  sthData?:     { exact: Map<string, { sth: number; cohortAgeDays: number }>; byStoreSku: Map<string, { sth: number; cohortAgeDays: number }> };
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
  estComercial: string;  // estado comercial ERP (lanzamiento, regular, liquidacion)
  carryOver:   boolean;  // true si carry over de temporada anterior
  productType: ProductType;  // clasificación lifecycle (carry_over | basicos | temporada)
}

