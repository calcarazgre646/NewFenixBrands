/**
 * features/salesPulse/hooks/useSalesPulseAdmin.ts
 *
 * Hook que reúne queries + mutations de subscribers, runs y trigger manual.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GC_60MIN, STALE_5MIN, salesPulseKeys } from "@/queries/keys";
import {
  addSubscriber,
  deleteRun,
  fetchRuns,
  fetchSubscribers,
  removeSubscriber,
  setSubscriberActive,
  triggerSalesPulse,
} from "@/queries/salesPulse.queries";

const RUNS_PAGE_SIZE = 12;

export function useSalesPulseAdmin() {
  const qc = useQueryClient();
  const [runsPage, setRunsPage] = useState(0);

  const subsQuery = useQuery({
    queryKey: salesPulseKeys.subscribers(),
    queryFn: fetchSubscribers,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const runsQuery = useQuery({
    queryKey: salesPulseKeys.runs(runsPage, RUNS_PAGE_SIZE),
    queryFn: () => fetchRuns(runsPage, RUNS_PAGE_SIZE),
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
    placeholderData: (prev) => prev, // smooth UX al cambiar de página
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
    onSuccess: () => qc.invalidateQueries({ queryKey: salesPulseKeys.runsAll() }),
  });

  const deleteRunMutation = useMutation({
    mutationFn: deleteRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: salesPulseKeys.runsAll() }),
  });

  const runs       = runsQuery.data?.rows ?? [];
  const runsTotal  = runsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(runsTotal / RUNS_PAGE_SIZE));

  return {
    subscribers: subsQuery.data ?? [],
    isLoadingSubscribers: subsQuery.isLoading,
    subscribersError: subsQuery.error as Error | null,

    runs,
    runsTotal,
    runsPage,
    runsPageSize: RUNS_PAGE_SIZE,
    runsTotalPages: totalPages,
    setRunsPage,
    isLoadingRuns: runsQuery.isLoading,
    isFetchingRuns: runsQuery.isFetching,
    runsError: runsQuery.error as Error | null,

    addSubscriber: addMutation,
    toggleActive: toggleActiveMutation,
    removeSubscriber: removeMutation,
    triggerSalesPulse: triggerMutation,
    deleteRun: deleteRunMutation,
  };
}
