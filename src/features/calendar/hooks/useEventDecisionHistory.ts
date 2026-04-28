/**
 * features/calendar/hooks/useEventDecisionHistory.ts
 *
 * Trae el log de decisiones (decision_runs + actions) tomadas para un evento.
 * Cada run corresponde a una propuesta aprobada (Fase B closed-loop).
 */
import { useQuery } from "@tanstack/react-query";
import { eventKeys, STALE_5MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchEventDecisionRuns,
  fetchEventDecisionActions,
} from "@/queries/events.queries";

export function useEventDecisionRuns(eventId: string | null | undefined) {
  return useQuery({
    queryKey: eventId ? eventKeys.decisionRuns(eventId) : ["events", "decisionRuns", "none"],
    queryFn: () => fetchEventDecisionRuns(eventId!),
    enabled: !!eventId,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });
}

export function useEventDecisionActions(runId: string | null | undefined) {
  return useQuery({
    queryKey: runId ? eventKeys.decisionActions(runId) : ["events", "decisionActions", "none"],
    queryFn: () => fetchEventDecisionActions(runId!),
    enabled: !!runId,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });
}
