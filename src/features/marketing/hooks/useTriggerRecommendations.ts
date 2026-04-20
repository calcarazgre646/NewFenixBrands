/**
 * features/marketing/hooks/useTriggerRecommendations.ts
 *
 * Hook que genera una recomendación de producto por cada trigger activo.
 * Combina inventario ITR + productos PIM (ya cacheados por otros hooks)
 * con el motor puro `recommendForTrigger`.
 *
 * Los datos de inventario/productos RESPONDEN a los filtros globales
 * (useFilters), por lo que las recomendaciones también reaccionan al canal,
 * marca y período que el usuario elija.
 */
import { useMemo } from "react";
import {
  recommendForTrigger,
  type Recommendation,
  type RecommendationInput,
} from "@/domain/marketing/recommendations";
import type { SamTrigger } from "@/domain/marketing/types";
import { useMarketingInventory } from "./useMarketingInventory";
import { useMarketingProducts } from "./useMarketingProducts";

export interface TriggerRecommendationsResult {
  /** Mapa triggerId → Recommendation (o null si no hay datos para recomendar) */
  byTrigger: Map<string, Recommendation | null>;
  isLoading: boolean;
}

export function useTriggerRecommendations(triggers: SamTrigger[]): TriggerRecommendationsResult {
  const inventory = useMarketingInventory();
  const products = useMarketingProducts();

  const isLoading = inventory.isLoading || products.isLoading;

  const byTrigger = useMemo(() => {
    const input: RecommendationInput = {
      lowStockItems: inventory.summary.lowStockItems,
      overstockItems: inventory.summary.overstockItems,
      topSellers: products.data.topSellers,
      slowMovers: products.data.slowMovers,
    };

    const map = new Map<string, Recommendation | null>();
    for (const t of triggers) {
      if (!t.isActive) continue;
      map.set(t.id, recommendForTrigger(t.category, input));
    }
    return map;
  }, [triggers, inventory.summary, products.data]);

  return { byTrigger, isLoading };
}
