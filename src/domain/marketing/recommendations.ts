/**
 * domain/marketing/recommendations.ts
 *
 * Inteligencia comercial para triggers de marketing (ticket Rodrigo 27/03/2026):
 * dado un trigger (regla activa), sugerir automáticamente QUÉ producto promocionar.
 *
 * v1: Función pura que cruza la categoría del trigger con datos ya disponibles
 * (inventario ITR + productos PIM) usando reglas explícitas por categoría.
 *
 * REGLA DE ARQUITECTURA: Sin Supabase, sin React. Entrada/salida serializables.
 * Los hooks alimentan los datos; este archivo solo decide.
 *
 * Estrategias:
 *   - urgency:       stock bajo → "últimas unidades, vender YA"
 *   - re_engagement: top seller → "producto que ya demostró atraer compra"
 *   - clearance:     slow mover con stock → "producto a liquidar con descuento"
 */
import type { TriggerCategory } from "./types";

// ─── Tipos (estructurales, compatibles con queries/marketing.queries) ───────

export interface RecInventoryItem {
  sku: string;
  description: string;
  brand: string;
  units: number;
}

export interface RecProductItem {
  sku: string;
  description: string;
  brand: string;
  units: number;
  weightPct: number;
}

export interface RecommendationInput {
  lowStockItems: RecInventoryItem[];
  overstockItems: RecInventoryItem[];
  topSellers: RecProductItem[];
  slowMovers: RecProductItem[];
}

export type RecommendationStrategy = "urgency" | "re_engagement" | "clearance";

export interface Recommendation {
  sku: string;
  description: string;
  brand: string;
  reason: string;       // Título de la recomendación ("Stock bajo", "Top seller", etc.)
  dataPoint: string;    // Dato cuantitativo visible ("3 unidades", "12.5% del total")
  strategy: RecommendationStrategy;
}

// ─── Mapeo de categoría → estrategia ────────────────────────────────────────

/**
 * Cada categoría de trigger tiene una estrategia natural:
 *   - low_stock   → urgencia (vender lo que se está acabando)
 *   - Re-engagement (inactividad, 1ra/2da compra, post-compra) → top seller
 *   - Liquidación (cobranza, devolución, ticket alto/bajo) → slow mover
 */
const STRATEGY_BY_CATEGORY: Record<TriggerCategory, RecommendationStrategy> = {
  low_stock:        "urgency",
  inactivity:       "re_engagement",
  first_purchase:   "re_engagement",
  second_purchase:  "re_engagement",
  post_purchase:    "re_engagement",
  overdue:          "clearance",
  return:           "clearance",
  high_ticket:      "clearance",
  low_ticket:       "clearance",
};

export function strategyForCategory(category: TriggerCategory): RecommendationStrategy {
  return STRATEGY_BY_CATEGORY[category];
}

// ─── Motor de recomendación ─────────────────────────────────────────────────

/**
 * Genera la recomendación principal para un trigger según su categoría.
 * Retorna null si no hay datos suficientes para decidir.
 */
export function recommendForTrigger(
  category: TriggerCategory,
  input: RecommendationInput,
): Recommendation | null {
  const strategy = strategyForCategory(category);

  switch (strategy) {
    case "urgency": {
      // Ordenar por menor stock (units > 0 garantizado por lowStockItems)
      const top = [...input.lowStockItems].sort((a, b) => a.units - b.units)[0];
      if (!top) return null;
      return {
        sku: top.sku,
        description: top.description,
        brand: top.brand,
        reason: "Stock bajo",
        dataPoint: `${top.units} unidad${top.units === 1 ? "" : "es"} disponibles`,
        strategy,
      };
    }

    case "re_engagement": {
      // Top seller #1 por peso % del total
      const top = input.topSellers[0];
      if (!top) return null;
      return {
        sku: top.sku,
        description: top.description,
        brand: top.brand,
        reason: "Top seller",
        dataPoint: `${top.weightPct.toFixed(1)}% del total vendido`,
        strategy,
      };
    }

    case "clearance": {
      // Slow mover con MÁS stock sobrante (si no hay overstock, tomar el 1er slow mover)
      const candidateSkus = new Set(input.slowMovers.map(p => p.sku));
      const slowInOverstock = input.overstockItems
        .filter(i => candidateSkus.has(i.sku))
        .sort((a, b) => b.units - a.units)[0];

      if (slowInOverstock) {
        return {
          sku: slowInOverstock.sku,
          description: slowInOverstock.description,
          brand: slowInOverstock.brand,
          reason: "Liquidar sobrestock",
          dataPoint: `${slowInOverstock.units} unidades en stock`,
          strategy,
        };
      }
      // Fallback: primer slow mover
      const fallback = input.slowMovers[0];
      if (!fallback) return null;
      return {
        sku: fallback.sku,
        description: fallback.description,
        brand: fallback.brand,
        reason: "Bajo rotación",
        dataPoint: `${fallback.weightPct.toFixed(2)}% del total (lento)`,
        strategy,
      };
    }
  }
}
