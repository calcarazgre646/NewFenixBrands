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
} from "@/queries/events.queries";
import {
  generateAllocationProposal,
  summarizeProposal,
} from "@/domain/events/allocation";
import type {
  EventInventoryRow,
  EventSku,
  EventStore,
} from "@/domain/events/types";

export interface GenerateProposalArgs {
  eventSkus: EventSku[];
  eventStores: EventStore[];
  inventory: EventInventoryRow[];
  generatedBy: string | null;
  readinessPct: number | null;
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
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) =>
      approveAllocationProposal(id, approvedBy),
    onSuccess: () => {
      if (eventId) qc.invalidateQueries({ queryKey: eventKeys.proposals(eventId) });
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
