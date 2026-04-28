/**
 * domain/events/types.ts
 *
 * Tipos del dominio "Calendar Event Operational App" (Fase A).
 *
 * Modelo (Palantir-style):
 *   RetailEvent (calendar_events) ──*── EventSku (style-color, no per-talle)
 *                                  ──*── EventStore (declaración explícita)
 *                                  ──1── AllocationProposal (versionada, reificada)
 *
 * Las funciones del domain son puras: no leen BD, reciben datos y devuelven
 * resultados deterministas. Los hooks orquestan datos y llaman a estas funciones.
 */

// ─── Entities ────────────────────────────────────────────────────────────────

/** SKU (style-color) vinculado a un evento. La curva de talles se deriva en runtime. */
export interface EventSku {
  id: string;
  eventId: string;
  skuComercial: string;
  brand: string;
  intent: EventSkuIntent;
  notes: string | null;
  createdAt: string;
}

export type EventSkuIntent = "sale" | "display" | "launch";

/** Tienda donde se ejecuta el evento. */
export interface EventStore {
  id: string;
  eventId: string;
  storeCode: string;
  role: EventStoreRole;
  createdAt: string;
}

export type EventStoreRole = "activation" | "warehouse" | "support";

/** Propuesta de allocation (versionada). El payload contiene las líneas. */
export interface AllocationProposal {
  id: string;
  eventId: string;
  version: number;
  status: AllocationProposalStatus;
  generatedAt: string;
  generatedBy: string | null;
  configVersionId: string | null;
  payload: AllocationLine[];
  totalLines: number;
  totalUnits: number;
  readinessPct: number | null;
  notes: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
}

export type AllocationProposalStatus = "draft" | "approved" | "superseded" | "rejected";

/** Línea individual de una propuesta (qué mover, desde dónde, hacia dónde). */
export interface AllocationLine {
  sku: string;             // SKU técnico ERP
  skuComercial: string;    // style-color
  talle: string;
  brand: string;
  fromStore: string | null; // null = sin origen identificado (compra externa)
  toStore: string;          // tienda destino del evento
  units: number;
  reason: AllocationReason;
  estimatedRevenue: number;
}

export type AllocationReason =
  | "transfer_from_store"     // hay stock en otra tienda no-evento
  | "restock_from_depot"      // hay stock en depot/STOCK central
  | "missing_size"            // talle faltante en la tienda evento (alguien lo tiene)
  | "out_of_stock";           // ningún lado tiene stock → señal de compra

// ─── Domain Inputs (interfaces minimas para mantener domain testeable) ───────

/**
 * Fila de inventario que el domain de events consume.
 * Subset de InventoryRecord — solo los campos que necesita.
 * Mantiene events desacoplado de actionQueue.
 */
export interface EventInventoryRow {
  sku: string;
  skuComercial: string;
  talle: string;
  brand: string;
  store: string;
  units: number;
  price: number;
}

/**
 * ETA de una importación en tránsito que matchea un SKU del evento.
 * Subset de LogisticsImport.
 */
export interface EventArrival {
  skuComercial: string;
  brand: string;
  eta: string | null;             // ISO date o null
  status: string;                 // "PEDIDO" | "EN TRANSITO" | "EN STOCK" | etc.
  units: number;
  description: string;
}

// ─── Computed (results de las pure functions) ────────────────────────────────

/** Cobertura de curva de talles para un SKU en una tienda. */
export interface CurveCoverage {
  skuComercial: string;
  store: string;
  presentTalles: string[];
  networkTalles: string[];
  missingTalles: string[];
  coveragePct: number;            // 0-100
  isComplete: boolean;            // missingTalles.length === 0
}

/** Scorecard del evento. */
export interface EventReadiness {
  eventId: string;
  daysToEvent: number | null;     // null si end_date inválido o evento ya pasó
  totalSkus: number;
  totalStores: number;
  // counters operativos
  skusOutOfStock: number;         // SKUs sin stock en ninguna tienda del evento
  skusWithIncompleteCurve: number; // SKUs con al menos 1 (sku, store) con curva incompleta
  skusWithPendingArrival: number; // SKUs con import en tránsito (no en stock)
  skusFullyReady: number;         // SKUs con stock + curva completa en todas las tiendas
  // métrica resumen
  readinessPct: number;           // 0-100. (skusFullyReady / totalSkus) * 100
  // exceptions list (top hits para mostrar)
  exceptions: ReadinessException[];
}

export interface ReadinessException {
  type: "no_stock" | "missing_size" | "pending_arrival";
  skuComercial: string;
  brand: string;
  store: string | null;          // null si aplica a varias tiendas
  detail: string;                // texto humano para mostrar
}
