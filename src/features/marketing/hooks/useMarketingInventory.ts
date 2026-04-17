/**
 * features/marketing/hooks/useMarketingInventory.ts
 *
 * Hook para datos de inventario desde perspectiva de marketing.
 * Usa fetchInventoryForMarketing (mv_stock_tienda via dataClient).
 * Filtrado por marca — lee useFilters() y pasa brand canonical al fetch.
 */
import { useQuery } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchInventoryForMarketing,
  type InventoryHealthSummary,
} from "@/queries/marketing.queries";
import { useFilters } from "@/hooks/useFilters";
import { brandIdToCanonical } from "@/api/normalize";

const EMPTY: InventoryHealthSummary = {
  totalSkus: 0,
  totalUnits: 0,
  totalValue: 0,
  lowStockCount: 0,
  overstockCount: 0,
  lowStockItems: [],
  overstockItems: [],
  byBrand: [],
};

export function useMarketingInventory() {
  const { filters } = useFilters();
  const brandCanonical = filters.brand !== "total" ? brandIdToCanonical(filters.brand) : null;

  const q = useQuery({
    queryKey: marketingKeys.inventory(brandCanonical),
    queryFn: () => fetchInventoryForMarketing(brandCanonical),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  return {
    summary: q.data ?? EMPTY,
    isLoading: q.isLoading,
    error: q.error,
  };
}
