/**
 * features/calendar/hooks/useAllocationProposals.ts
 *
 * Listado, generación y aprobación de propuestas de allocation para un evento.
 *
 * La generación es híbrida: el hook recibe del orquestador (useEventDashboard)
 * los inputs ya armados (eventSkus, eventStores, inventory) y llama a la
 * pure function `generateAllocationProposal` del domain. Después persiste
 * en BD vía `createAllocationProposal`.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventKeys, STALE_5MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchAllocationProposals,
  createAllocationProposal,
  approveAllocationProposal,
  rejectAllocationProposal,
  createEventDecisionRun,
  bulkInsertEventDecisionActions,
} from "@/queries/events.queries";
import {
  generateAllocationProposal,
  summarizeProposal,
} from "@/domain/events/allocation";
import { buildEventDecisionPayload } from "@/domain/events/closedLoop";
import { computeNetworkCurves } from "@/domain/events/curveCompleteness";
import type {
  AllocationProposal,
  EventInventoryRow,
  EventSku,
  EventStore,
} from "@/domain/events/types";
import type { StoreConfig } from "@/domain/config/types";

export interface GenerateProposalArgs {
  eventSkus: EventSku[];
  eventStores: EventStore[];
  inventory: EventInventoryRow[];
  generatedBy: string | null;
  readinessPct: number | null;
  /**
   * Config de tiendas para derivar `assortment` per-store. Cuando está disponible,
   * el generador usa `assortment / talles_de_curva` como target ideal por talle.
   * Si la tienda no tiene assortment, fallback a 1 (comportamiento Fase A).
   */
  storeConfig?: StoreConfig;
  notes?: string;
}

export function useAllocationProposals(eventId: string | null | undefined) {
  const qc = useQueryClient();

  const proposalsQ = useQuery({
    queryKey: eventId ? eventKeys.proposals(eventId) : ["events", "proposals", "none"],
    queryFn: () => fetchAllocationProposals(eventId!),
    enabled: !!eventId,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const generateM = useMutation({
    mutationFn: async (args: GenerateProposalArgs) => {
      if (!eventId) throw new Error("eventId requerido");
      // Build idealUnitsLookup desde storeConfig.assortments + curva de la red
      const networkCurves = computeNetworkCurves(args.inventory);
      const lookup = args.storeConfig
        ? buildIdealUnitsLookup(args.storeConfig, networkCurves)
        : undefined;
      const lines = generateAllocationProposal({
        eventSkus: args.eventSkus.map((s) => ({
          skuComercial: s.skuComercial,
          brand: s.brand,
        })),
        eventStores: args.eventStores.map((s) => ({
          storeCode: s.storeCode,
          role: s.role,
        })),
        inventory: args.inventory,
        idealUnitsLookup: lookup,
      });
      const summary = summarizeProposal(lines);
      return createAllocationProposal({
        eventId,
        generatedBy: args.generatedBy,
        payload: lines,
        totalLines: summary.totalLines,
        totalUnits: summary.totalUnits,
        readinessPct: args.readinessPct,
        notes: args.notes ?? null,
      });
    },
    onSuccess: () => {
      if (eventId) qc.invalidateQueries({ queryKey: eventKeys.proposals(eventId) });
    },
  });

  const approveM = useMutation({
    mutationFn: async (args: {
      proposal: AllocationProposal;
      approvedBy: string;
      inventorySnapshot: EventInventoryRow[];
      readinessPctAtApproval: number | null;
    }) => {
      if (!eventId) throw new Error("eventId requerido");
      // 1. Closed-loop: build run + actions desde el payload + snapshot
      const payload = buildEventDecisionPayload({
        proposal: args.proposal,
        eventId,
        inventory: args.inventorySnapshot,
        approverId: args.approvedBy,
        readinessPctAtApproval: args.readinessPctAtApproval,
      });
      // 2. Insert run, obtener id, bulk insert actions
      const runId = await createEventDecisionRun(payload.run);
      await bulkInsertEventDecisionActions(runId, payload.actions);
      // 3. Marcar propuesta como aprobada
      return approveAllocationProposal(args.proposal.id, args.approvedBy);
    },
    onSuccess: () => {
      if (eventId) {
        qc.invalidateQueries({ queryKey: eventKeys.proposals(eventId) });
        // Refrescar historial: el decision_run nuevo aparece acá
        qc.invalidateQueries({ queryKey: eventKeys.decisionRuns(eventId) });
      }
    },
  });

  const rejectM = useMutation({
    mutationFn: (id: string) => rejectAllocationProposal(id),
    onSuccess: () => {
      if (eventId) qc.invalidateQueries({ queryKey: eventKeys.proposals(eventId) });
    },
  });

  return {
    proposals: proposalsQ.data ?? [],
    isLoading: proposalsQ.isLoading,
    error: proposalsQ.error,
    generate: generateM.mutateAsync,
    approve: approveM.mutateAsync,
    reject: rejectM.mutateAsync,
    isGenerating: generateM.isPending,
    isApproving: approveM.isPending,
  };
}

// ─── Ideal units lookup helper ───────────────────────────────────────────────

/**
 * Construye lookup (sku, talle, store) → unidades ideales desde:
 *   - assortment de la tienda (config_store.assortment)
 *   - cantidad de talles del SKU en la red
 *
 * Heurística: distribuir el assortment uniformemente entre los talles del SKU.
 * Mínimo 1 unidad por talle, redondeo hacia arriba para no sub-asignar.
 *
 * Si la tienda no tiene assortment definido, retorna 1 (fallback).
 */
function buildIdealUnitsLookup(
  storeConfig: StoreConfig,
  networkCurves: Map<string, string[]>,
): (sku: string, talle: string, store: string) => number {
  return (sku, _talle, store) => {
    const assortment = storeConfig.assortments[store];
    if (!assortment || assortment <= 0) return 1;
    const talles = networkCurves.get(sku);
    if (!talles || talles.length === 0) return 1;
    return Math.max(1, Math.ceil(assortment / talles.length));
  };
}
