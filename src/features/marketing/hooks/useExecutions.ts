/**
 * features/marketing/hooks/useExecutions.ts
 *
 * Hook para log de ejecuciones SAM con filtros y paginación.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { fetchSamExecutions } from "@/queries/marketing.queries";
import type { ExecutionStatus } from "@/domain/marketing/types";

const PAGE_SIZE = 50;

export function useExecutions() {
  const [triggerFilter, setTriggerFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | null>(null);
  const [page, setPage] = useState(0);

  const filters = useMemo(() => ({
    triggerId: triggerFilter ?? undefined,
    status: statusFilter ?? undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [triggerFilter, statusFilter, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: marketingKeys.executions(filters),
    queryFn: () => fetchSamExecutions(filters),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  return {
    executions: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error ? (error as Error).message : null,
    page,
    setPage: (p: number) => setPage(p),
    triggerFilter,
    setTriggerFilter: (v: string | null) => { setTriggerFilter(v); setPage(0); },
    statusFilter,
    setStatusFilter: (v: ExecutionStatus | null) => { setStatusFilter(v); setPage(0); },
  };
}
