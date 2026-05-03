/**
 * features/salesPulse/hooks/useSalesPulseAdmin.ts
 *
 * Hook que reúne queries + mutations de subscribers, runs y trigger manual.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GC_60MIN, STALE_5MIN, salesPulseKeys } from "@/queries/keys";
import {
  addSubscriber,
  fetchRuns,
  fetchSubscribers,
  removeSubscriber,
  setSubscriberActive,
  triggerSalesPulse,
} from "@/queries/salesPulse.queries";

export function useSalesPulseAdmin() {
  const qc = useQueryClient();

  const subsQuery = useQuery({
    queryKey: salesPulseKeys.subscribers(),
    queryFn: fetchSubscribers,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const runsQuery = useQuery({
    queryKey: salesPulseKeys.runs(12),
    queryFn: () => fetchRuns(12),
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const addMutation = useMutation({
    mutationFn: addSubscriber,
    onSuccess: () => qc.invalidateQueries({ queryKey: salesPulseKeys.subscribers() }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setSubscriberActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: salesPulseKeys.subscribers() }),
  });

  const removeMutation = useMutation({
    mutationFn: removeSubscriber,
    onSuccess: () => qc.invalidateQueries({ queryKey: salesPulseKeys.subscribers() }),
  });

  const triggerMutation = useMutation({
    mutationFn: triggerSalesPulse,
    onSuccess: () => qc.invalidateQueries({ queryKey: salesPulseKeys.runs(12) }),
  });

  return {
    subscribers: subsQuery.data ?? [],
    isLoadingSubscribers: subsQuery.isLoading,
    subscribersError: subsQuery.error as Error | null,

    runs: runsQuery.data ?? [],
    isLoadingRuns: runsQuery.isLoading,
    runsError: runsQuery.error as Error | null,

    addSubscriber: addMutation,
    toggleActive: toggleActiveMutation,
    removeSubscriber: removeMutation,
    triggerSalesPulse: triggerMutation,
  };
}
