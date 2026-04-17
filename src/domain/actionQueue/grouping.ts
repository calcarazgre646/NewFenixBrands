/**
 * domain/actionQueue/grouping.ts
 *
 * Agrupación de acciones para vista por Tienda o por Marca.
 * Función pura — no React, no side effects.
 *
 * Dos niveles de agrupación:
 *   1. Por tienda o por marca (ActionGroup)
 *   2. Dentro de cada grupo, por intención operativa (ActionSection)
 *
 * Las secciones representan tareas concretas que alguien puede ejecutar:
 *   - "Recibir transferencias de otras tiendas"
 *   - "Recibir reposición desde depósito"
 *   - "Redistribuir excedentes"
 *   - "Abastecer RETAILS desde STOCK"
 *   - "Envío directo B2B"
 */
import type { ActionItemFull } from "./waterfall";
import type { StoreCluster } from "./types";
import {
  getStoreCluster, getTimeRestriction, getStoreAssortment,
  STORE_CLUSTERS, STORE_TIME_RESTRICTIONS, STORE_ASSORTMENT,
} from "./clusters";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GroupByMode = "store" | "brand" | "priority";

/** Priority level for urgency-based grouping */
export type PriorityLevel = "critical" | "high" | "normal";

const PRIORITY_ORDER: PriorityLevel[] = ["critical", "high", "normal"];

const PRIORITY_META: Record<PriorityLevel, { label: string; description: string }> = {
  critical: { label: "Crítico", description: "Sin stock o salida obligatoria (90d+)" },
  high:     { label: "Alto", description: "Stock bajo o intervención lifecycle requerida" },
  normal:   { label: "Normal", description: "Acciones de optimización y rebalanceo" },
};

/**
 * Classify an action item into a priority level.
 * Uses risk level + lifecycle age — NOT impactScore (which is financial, not operational urgency).
 */
export function classifyPriority(item: ActionItemFull): PriorityLevel {
  // Critical: stockout or forced exit (90d+)
  if (item.risk === "critical") return "critical";
  if (item.category === "lifecycle" && (item.cohortAgeDays ?? 0) >= 90) return "critical";
  // High: low stock or lifecycle needing commercial intervention (45d+)
  if (item.risk === "low") return "high";
  if (item.category === "lifecycle" && (item.cohortAgeDays ?? 0) >= 45) return "high";
  // Normal: everything else (overstock redistribution, review, reposition)
  return "normal";
}

/**
 * Operational intent — what the person needs to DO.
 * Derived from actionType + risk to create meaningful work orders.
 */
export type OperationalIntent =
  | "receive_transfer"    // Deficit store receiving from other stores
  | "receive_depot"       // Deficit store receiving from RETAILS depot
  | "resupply_depot"      // RETAILS needs resupply from STOCK central
  | "redistribute"        // Surplus store sending excess to others or liquidating
  | "ship_b2b"            // Direct shipment from STOCK to B2B client
  // Lifecycle intents
  | "lifecycle_review"    // revisar_exhibicion, revisar_asignacion
  | "lifecycle_commercial" // accion_comercial, markdown_selectivo
  | "lifecycle_exit"      // transferencia_out_lifecycle, markdown_liquidacion
  | "lifecycle_reposition"; // reposicion_tallas, consolidar_curva

/** A work-order section within a group */
export interface ActionSection {
  intent: OperationalIntent;
  label: string;
  description: string;
  items: ActionItemFull[];
  totalUnits: number;
  totalGapUnits: number;
  criticalCount: number;
}

export interface ActionGroup {
  key: string;
  label: string;
  cluster: StoreCluster | null;
  timeRestriction: string | null;
  assortmentCapacity: number | null;
  /** All items in this group (flat, for stats and export) */
  items: ActionItemFull[];
  /** Items split into operational work-order sections */
  sections: ActionSection[];
  totalActions: number;
  criticalCount: number;
  lowCount: number;
  overstockCount: number;
  totalImpact: number;
  uniqueSkus: number;
  totalUnits: number;
  totalGapUnits: number;
  avgDOI: number;
}

// ─── Intent classification ──────────────────────────────────────────────────

const INTENT_ORDER: OperationalIntent[] = [
  "receive_transfer",
  "receive_depot",
  "resupply_depot",
  "redistribute",
  "ship_b2b",
  "lifecycle_reposition",
  "lifecycle_review",
  "lifecycle_commercial",
  "lifecycle_exit",
];

const INTENT_META: Record<OperationalIntent, { label: string; description: string }> = {
  receive_transfer: {
    label: "Recibir de otras tiendas",
    description: "Transferencias laterales desde tiendas con excedente",
  },
  receive_depot: {
    label: "Recibir desde deposito",
    description: "Reposicion desde RETAILS",
  },
  resupply_depot: {
    label: "Abastecer RETAILS desde STOCK",
    description: "Mover stock desde STOCK a RETAILS para cubrir deficit",
  },
  redistribute: {
    label: "Redistribuir excedentes",
    description: "Enviar sobrestock a tiendas con deficit o liquidar",
  },
  ship_b2b: {
    label: "Envio directo B2B",
    description: "Despacho desde STOCK central a cliente mayorista",
  },
  lifecycle_review: {
    label: "Revisar exhibicion y asignacion",
    description: "SKUs que necesitan revision de exhibicion o reasignacion de tienda",
  },
  lifecycle_commercial: {
    label: "Accion comercial / Markdown",
    description: "SKUs que requieren intervencion comercial o markdown selectivo",
  },
  lifecycle_exit: {
    label: "Salida de inventario",
    description: "SKUs para transferir a outlet o liquidar con markdown progresivo",
  },
  lifecycle_reposition: {
    label: "Curva de tallas",
    description: "SKUs que necesitan reposicion o consolidacion de tallas",
  },
};

export function classifyIntent(item: ActionItemFull): OperationalIntent {
  // Lifecycle actions (category check first — fast path)
  if (item.category === "lifecycle") {
    if (item.actionType === "reposicion_tallas" || item.actionType === "consolidar_curva")
      return "lifecycle_reposition";
    if (item.actionType === "revisar_exhibicion" || item.actionType === "revisar_asignacion")
      return "lifecycle_review";
    if (item.actionType === "accion_comercial" || item.actionType === "markdown_selectivo")
      return "lifecycle_commercial";
    return "lifecycle_exit";
  }
  // Movement actions (existing logic unchanged)
  if (item.actionType === "central_to_b2b") return "ship_b2b";
  if (item.actionType === "resupply_depot") return "resupply_depot";
  if (item.actionType === "restock_from_depot") return "receive_depot";
  if (item.risk === "overstock") return "redistribute";
  return "receive_transfer";
}

// ─── Section builder ─────────────────────────────────────────────────────────

export function splitIntoSections(items: ActionItemFull[]): ActionSection[] {
  const byIntent = new Map<OperationalIntent, ActionItemFull[]>();

  for (const item of items) {
    const intent = classifyIntent(item);
    const list = byIntent.get(intent);
    if (list) {
      list.push(item);
    } else {
      byIntent.set(intent, [item]);
    }
  }

  const sections: ActionSection[] = [];
  for (const intent of INTENT_ORDER) {
    const sectionItems = byIntent.get(intent);
    if (!sectionItems || sectionItems.length === 0) continue;

    const meta = INTENT_META[intent];
    let critical = 0;
    let totalUnits = 0;
    let totalGap = 0;
    for (const item of sectionItems) {
      if (item.risk === "critical") critical++;
      totalUnits += item.suggestedUnits;
      totalGap += item.gapUnits;
    }

    sections.push({
      intent,
      label: meta.label,
      description: meta.description,
      items: sectionItems,
      totalUnits,
      totalGapUnits: totalGap,
      criticalCount: critical,
    });
  }

  return sections;
}

// ─── Top-level grouping ─────────────────────────────────────────────────────

/**
 * Groups actions by store or brand, then splits each group into
 * operational sections (work orders). Sorted by totalImpact descending.
 */
export function groupActions(
  items: ActionItemFull[],
  mode: GroupByMode,
  clusters: Record<string, StoreCluster> = STORE_CLUSTERS,
  timeRestrictions: Record<string, string> = STORE_TIME_RESTRICTIONS,
  assortments: Record<string, number> = STORE_ASSORTMENT,
): ActionGroup[] {
  if (items.length === 0) return [];

  // Priority mode: group by urgency level, sorted by priority order (not impact)
  if (mode === "priority") {
    return groupByPriority(items, clusters, timeRestrictions, assortments);
  }

  const map = new Map<string, ActionItemFull[]>();
  for (const item of items) {
    const key = mode === "store" ? item.store : item.brand;
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  const groups: ActionGroup[] = [];
  for (const [key, groupItems] of map) {
    groups.push(buildGroup(key, groupItems, mode, clusters, timeRestrictions, assortments));
  }

  groups.sort((a, b) => b.totalImpact - a.totalImpact);
  return groups;
}

/** Group by priority level (critical → high → normal). Within each group, items sorted by impactScore desc. */
function groupByPriority(
  items: ActionItemFull[],
  clusters: Record<string, StoreCluster>,
  timeRestrictions: Record<string, string>,
  assortments: Record<string, number>,
): ActionGroup[] {
  const byPriority = new Map<PriorityLevel, ActionItemFull[]>();
  for (const item of items) {
    const priority = classifyPriority(item);
    const list = byPriority.get(priority);
    if (list) list.push(item);
    else byPriority.set(priority, [item]);
  }

  const groups: ActionGroup[] = [];
  for (const priority of PRIORITY_ORDER) {
    const priorityItems = byPriority.get(priority);
    if (!priorityItems || priorityItems.length === 0) continue;
    // Sort items within priority by impact desc
    priorityItems.sort((a, b) => b.impactScore - a.impactScore);
    const meta = PRIORITY_META[priority];
    const group = buildGroup(priority, priorityItems, "priority", clusters, timeRestrictions, assortments);
    group.label = meta.label;
    groups.push(group);
  }

  return groups; // Already in priority order, do NOT re-sort by impact
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGroup(
  key: string,
  items: ActionItemFull[],
  mode: GroupByMode,
  clusters: Record<string, StoreCluster>,
  timeRestrictions: Record<string, string>,
  assortments: Record<string, number>,
): ActionGroup {
  let critical = 0;
  let low = 0;
  let overstock = 0;
  let totalImpact = 0;
  let totalUnits = 0;
  let totalGap = 0;
  let doiWeightedSum = 0;
  let doiWeightTotal = 0;
  const skuSet = new Set<string>();

  for (const item of items) {
    if (item.risk === "critical") critical++;
    else if (item.risk === "low") low++;
    else if (item.risk === "overstock") overstock++;
    totalImpact += item.impactScore;
    totalUnits += item.suggestedUnits;
    totalGap += item.gapUnits;
    skuSet.add(item.sku);
    // Weighted DOI: weight by historicalAvg (items with more sales matter more)
    if (item.daysOfInventory > 0 || item.historicalAvg > 0) {
      const w = item.historicalAvg > 0 ? item.historicalAvg : 1;
      doiWeightedSum += item.daysOfInventory * w;
      doiWeightTotal += w;
    }
  }

  return {
    key,
    label: key,
    cluster: mode === "store" ? getStoreCluster(key, clusters) : null,
    timeRestriction: mode === "store" ? getTimeRestriction(key, timeRestrictions) : null,
    assortmentCapacity: mode === "store" ? getStoreAssortment(key, assortments) : null,
    items,
    sections: splitIntoSections(items),
    totalActions: items.length,
    criticalCount: critical,
    lowCount: low,
    overstockCount: overstock,
    totalImpact,
    uniqueSkus: skuSet.size,
    totalUnits,
    totalGapUnits: totalGap,
    avgDOI: doiWeightTotal > 0 ? doiWeightedSum / doiWeightTotal : 0,
  };
}
