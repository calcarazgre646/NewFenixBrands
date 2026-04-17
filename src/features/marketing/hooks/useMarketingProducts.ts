/**
 * features/marketing/hooks/useMarketingProducts.ts
 *
 * Hook para datos de performance de productos desde perspectiva de marketing.
 * Usa fetchProductPerformance (fjdhstvta1 + Dim_maestro_comercial via dataClient).
 */
import { useQuery } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchProductPerformance,
  type PimSummary,
} from "@/queries/marketing.queries";

const EMPTY: PimSummary = {
  topSellers: [],
  slowMovers: [],
  totalProducts: 0,
  byBrand: [],
  byType: [],
};

export function useMarketingProducts() {
  const q = useQuery({
    queryKey: marketingKeys.products(),
    queryFn: fetchProductPerformance,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  return {
    data: q.data ?? EMPTY,
    isLoading: q.isLoading,
    error: q.error,
  };
}
