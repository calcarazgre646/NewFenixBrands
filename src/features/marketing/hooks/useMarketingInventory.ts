/**
 * features/marketing/hooks/useMarketingInventory.ts
 *
 * Hook para datos de inventario desde perspectiva de marketing.
 * Usa fetchInventoryForMarketing (mv_stock_tienda via dataClient).
 */
import { useQuery } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchInventoryForMarketing,
  type InventoryHealthSummary,
} from "@/queries/marketing.queries";

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
  const q = useQuery({
    queryKey: marketingKeys.inventory(),
    queryFn: fetchInventoryForMarketing,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  return {
    summary: q.data ?? EMPTY,
    isLoading: q.isLoading,
    error: q.error,
  };
}
