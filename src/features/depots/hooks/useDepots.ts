/**
 * features/depots/hooks/useDepots.ts
 *
 * Hook que orquesta datos para la vista Depósitos & Cobertura.
 *
 * Patrón: Fetch-wide → filter-local.
 *   1. Trae TODO el inventario (mv_stock_tienda, ~5-10K filas, ya cacheado)
 *   2. Trae historial de ventas 6m (mv_ventas_12m_por_tienda_sku)
 *   3. Calcula métricas con funciones puras de domain/depots
 *
 * Reutiliza queries ya existentes (fetchInventory, fetchSalesHistory).
 */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchInventory } from "@/queries/inventory.queries";
import { fetchSalesHistory } from "@/queries/salesHistory.queries";
import { inventoryKeys, depotKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { buildDepotData } from "@/domain/depots/calculations";
import type { DepotData } from "@/domain/depots/types";
import { useFilters } from "@/hooks/useFilters";
import { useDepotConfig, useStoreConfig } from "@/hooks/useConfig";

export interface UseDepotsResult {
  data:      DepotData | null;
  isLoading: boolean;
  error:     Error | null;
}

export function useDepots(): UseDepotsResult {
  const { filters } = useFilters();
  const depotConfig = useDepotConfig();
  const storeConfig = useStoreConfig();

  // ── 1. Inventario completo (ya cacheado por ActionQueue/KPIs) ──────────
  const [inventoryQ, salesHistQ] = useQueries({
    queries: [
      {
        queryKey: inventoryKeys.list(),
        queryFn: fetchInventory,
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        // Placeholder — se actualiza cuando tenemos SKUs del inventario
        queryKey: depotKeys.coverage(),
        queryFn: async () => {
          // Fetch inventory first to get SKU list
          const inv = await fetchInventory();
          const skus = [...new Set(inv.map((i) => i.sku))];
          return fetchSalesHistory(skus);
        },
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
    ],
  });

  // ── 2. Calcular datos de depósitos ─────────────────────────────────────
  const data = useMemo<DepotData | null>(() => {
    if (!inventoryQ.data || !salesHistQ.data) return null;

    const allData = buildDepotData(inventoryQ.data, salesHistQ.data, depotConfig, storeConfig.clusters);

    // Aplicar filtro de marca global si está activo
    if (filters.brand !== "total") {
      const filtered = inventoryQ.data.filter(
        (i) => i.brand.toLowerCase() === filters.brand.toLowerCase()
      );
      return buildDepotData(filtered, salesHistQ.data, depotConfig, storeConfig.clusters);
    }

    return allData;
  }, [inventoryQ.data, salesHistQ.data, filters.brand, depotConfig, storeConfig.clusters]);

  const isLoading = inventoryQ.isLoading || salesHistQ.isLoading;
  const error = (inventoryQ.error ?? salesHistQ.error) as Error | null;

  return { data, isLoading, error };
}
