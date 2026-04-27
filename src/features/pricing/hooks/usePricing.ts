/**
 * features/pricing/hooks/usePricing.ts
 *
 * Hook de datos para la página de Precios.
 * Patrón: copia fiel de useMarketingInventory — lee filters.brand y
 * pasa brand canónica a fetchPrices para filtrar server-side.
 */
import { useQuery } from "@tanstack/react-query";
import { pricingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { fetchPrices, type PricingRow } from "@/queries/pricing.queries";
import { useFilters } from "@/hooks/useFilters";
import { brandIdToCanonical } from "@/api/normalize";

const EMPTY: PricingRow[] = [];

export function usePricing() {
  const { filters } = useFilters();
  const brandCanonical = filters.brand !== "total" ? brandIdToCanonical(filters.brand) : null;

  const q = useQuery({
    queryKey: pricingKeys.list(brandCanonical),
    queryFn: () => fetchPrices(brandCanonical),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  return {
    rows: q.data ?? EMPTY,
    isLoading: q.isLoading,
    error: q.error,
  };
}
