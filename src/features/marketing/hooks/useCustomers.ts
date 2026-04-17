/**
 * features/marketing/hooks/useCustomers.ts
 *
 * Hook para lista paginada de clientes SAM con búsqueda y filtro de tier.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { fetchSamCustomers } from "@/queries/marketing.queries";
import type { CustomerTier } from "@/domain/marketing/types";

type TierFilter = CustomerTier | "all";
const PAGE_SIZE = 50;

export function useCustomers() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [page, setPage] = useState(0);

  const filters = useMemo(() => ({
    search: search || undefined,
    tier: tierFilter !== "all" ? tierFilter : undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [search, tierFilter, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: marketingKeys.customers(filters),
    queryFn: () => fetchSamCustomers(filters),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  return {
    customers: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error ? (error as Error).message : null,
    search,
    setSearch: (v: string) => { setSearch(v); setPage(0); },
    tierFilter,
    setTierFilter: (v: TierFilter) => { setTierFilter(v); setPage(0); },
    page,
    setPage,
    pageSize: PAGE_SIZE,
  };
}
