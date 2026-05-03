/**
 * features/pricing/hooks/useSkuMarkdowns.ts
 *
 * Lee markdowns activos + expone mutations para upsert/clear.
 * Invalidación: pricing.list (la tabla muestra PVP efectivo) + markdowns.active.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { markdownKeys, pricingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchActiveMarkdowns,
  upsertMarkdown,
  clearMarkdown,
} from "@/queries/markdowns.queries";
import { useFilters } from "@/hooks/useFilters";
import { brandIdToCanonical } from "@/api/normalize";
import type { ActiveMarkdown } from "@/domain/pricing/markdown";

interface UpsertArgs {
  skuComercial: string;
  brand: string;
  markdownPct: number;
  note?: string | null;
  validUntil?: string | null;
}

const EMPTY: ActiveMarkdown[] = [];

export function useSkuMarkdowns() {
  const { filters } = useFilters();
  const brandCanonical = filters.brand !== "total" ? brandIdToCanonical(filters.brand) : null;
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: markdownKeys.active(brandCanonical),
    queryFn: () => fetchActiveMarkdowns(brandCanonical),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  /** Map sku_comercial → markdown activo. Lookup O(1) en la tabla. */
  const bySku = useMemo(() => {
    const map = new Map<string, ActiveMarkdown>();
    for (const m of listQ.data ?? EMPTY) map.set(m.skuComercial, m);
    return map;
  }, [listQ.data]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: markdownKeys.all });
    qc.invalidateQueries({ queryKey: pricingKeys.all });
  };

  const upsertM = useMutation({
    mutationFn: (args: UpsertArgs) => upsertMarkdown(args),
    onSuccess: invalidateAll,
  });

  const clearM = useMutation({
    mutationFn: (skuComercial: string) => clearMarkdown(skuComercial),
    onSuccess: invalidateAll,
  });

  return {
    bySku,
    isLoading: listQ.isLoading,
    error: listQ.error,
    upsert: upsertM,
    clear: clearM,
  };
}
