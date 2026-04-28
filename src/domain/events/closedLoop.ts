/**
 * domain/events/closedLoop.ts
 *
 * Cierre del loop Palantir-style: cuando se aprueba una AllocationProposal,
 * cada línea del payload se persiste como una `decision_action` con snapshot
 * del estado del mundo al momento de aprobar.
 *
 * Esto convierte cada decisión humana en data analizable a futuro:
 * "¿qué SKU/talle/tienda decidimos mover el día X y con cuánto stock real?"
 *
 * Pure function — sin BD ni efectos.
 */
import type { AllocationLine, AllocationProposal, EventInventoryRow } from "./types";

// ─── Output types (mapean al schema de decision_runs / decision_actions) ─────

/**
 * Run row a insertar en `decision_runs`.
 * `triggered_by` y `triggered_at` los maneja la BD/cliente Supabase.
 */
export interface EventDecisionRunInput {
  runType: "event_allocation";
  triggeredBy: string;             // user.id (UUID)
  filtersSnapshot: {
    eventId: string;
    proposalId: string;
    proposalVersion: number;
  };
  totalActions: number;
  totalGapUnits: number;
  totalImpactGs: number;
  paretoCount: number;
  criticalCount: number;
  metadata: {
    readinessPctAtApproval: number | null;
    inventorySnapshotRowCount: number;
  };
}

/** Action row a insertar en `decision_actions`. */
export interface EventDecisionActionInput {
  rank: number;
  sku: string;
  skuComercial: string;
  talle: string;
  brand: string;
  description: string;
  store: string;                   // toStore
  targetStore: string | null;      // fromStore (null si out_of_stock)
  currentStock: number;            // snapshot al momento de aprobar
  suggestedUnits: number;
  idealUnits: number;
  gapUnits: number;
  daysOfInventory: number;
  historicalAvg: number;
  coverWeeks: number;
  currentMos: number;
  risk: "critical" | "low" | "balanced" | "overstock";
  waterfallLevel: "store_to_store" | "depot_to_store" | "central_to_depot" | "central_to_b2b";
  actionType: string;
  impactScore: number;
  paretoFlag: boolean;
  recommendedAction: string;
  status: "approved";              // entra ya aprobada (no pasa por pending)
  reviewedBy: string;
  calendarEventId: string;
  allocationProposalId: string;
}

export interface EventDecisionPayload {
  run: EventDecisionRunInput;
  actions: EventDecisionActionInput[];
}

// ─── Reason → (waterfall_level, action_type) mapping ─────────────────────────

const REASON_MAP: Record<
  AllocationLine["reason"],
  { waterfallLevel: EventDecisionActionInput["waterfallLevel"]; actionType: string; label: string }
> = {
  transfer_from_store: {
    waterfallLevel: "store_to_store",
    actionType: "transfer",
    label: "Transferir desde otra tienda",
  },
  missing_size: {
    waterfallLevel: "store_to_store",
    actionType: "transfer",
    label: "Reponer talle faltante desde otra tienda",
  },
  restock_from_depot: {
    waterfallLevel: "depot_to_store",
    actionType: "restock_from_depot",
    label: "Reponer desde depósito",
  },
  out_of_stock: {
    waterfallLevel: "central_to_depot",
    actionType: "resupply_depot",
    label: "Sin stock — señal de compra externa",
  },
};

// ─── Core ────────────────────────────────────────────────────────────────────

export interface BuildPayloadInput {
  proposal: AllocationProposal;
  eventId: string;
  inventory: EventInventoryRow[];   // inventario completo al momento de aprobar (para snapshot)
  approverId: string;
  readinessPctAtApproval: number | null;
}

export function buildEventDecisionPayload(input: BuildPayloadInput): EventDecisionPayload {
  const { proposal, eventId, inventory, approverId, readinessPctAtApproval } = input;

  // Index inventory para snapshot rápido: Map<"sku|talle|store", units>
  const stockIndex = new Map<string, number>();
  for (const row of inventory) {
    const key = `${row.skuComercial}|${row.talle}|${row.store}`;
    stockIndex.set(key, (stockIndex.get(key) ?? 0) + row.units);
  }

  const actions: EventDecisionActionInput[] = proposal.payload.map((line, idx) => {
    const map = REASON_MAP[line.reason];
    const stockKey = `${line.skuComercial}|${line.talle}|${line.toStore}`;
    const currentStock = stockIndex.get(stockKey) ?? 0;
    const recommendedAction =
      line.fromStore !== null
        ? `${map.label}: ${line.fromStore} → ${line.toStore}`
        : `${map.label} (sin origen identificado)`;
    return {
      rank: idx + 1,
      sku: line.sku || "—",
      skuComercial: line.skuComercial,
      talle: line.talle || "—",
      brand: line.brand,
      description: line.skuComercial,
      store: line.toStore,
      targetStore: line.fromStore,
      currentStock,
      suggestedUnits: line.units,
      idealUnits: line.units,           // event-driven push: ideal = lo que la propuesta planificó
      gapUnits: 0,                      // la propuesta ya cubre el gap
      daysOfInventory: 0,
      historicalAvg: 0,
      coverWeeks: 0,
      currentMos: 0,
      risk: line.reason === "out_of_stock" ? "critical" : "balanced",
      waterfallLevel: map.waterfallLevel,
      actionType: map.actionType,
      impactScore: line.estimatedRevenue,
      paretoFlag: false,
      recommendedAction,
      status: "approved",
      reviewedBy: approverId,
      calendarEventId: eventId,
      allocationProposalId: proposal.id,
    };
  });

  // Run aggregate metrics
  const totalActions = actions.length;
  const totalImpactGs = actions.reduce((sum, a) => sum + a.impactScore, 0);
  const criticalCount = actions.filter((a) => a.risk === "critical").length;

  const run: EventDecisionRunInput = {
    runType: "event_allocation",
    triggeredBy: approverId,
    filtersSnapshot: {
      eventId,
      proposalId: proposal.id,
      proposalVersion: proposal.version,
    },
    totalActions,
    totalGapUnits: 0,                  // event-driven: gap se define ad-hoc por la propuesta
    totalImpactGs,
    paretoCount: 0,
    criticalCount,
    metadata: {
      readinessPctAtApproval,
      inventorySnapshotRowCount: inventory.length,
    },
  };

  return { run, actions };
}
