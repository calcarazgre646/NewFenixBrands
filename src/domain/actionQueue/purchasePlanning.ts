/**
 * domain/actionQueue/purchasePlanning.ts
 *
 * Agregación de gap de stock para planificación de compra.
 * Pure function — no React, no side effects.
 *
 * Toma las acciones del waterfall y produce una lista a nivel SKU
 * de producto nuevo que el negocio necesita comprar (gap = idealUnits - suggestedUnits).
 *
 * Cada fila incluye brand, linea, categoria para que el UI pueda filtrar.
 * Los totales por marca/tipo se computan como resúmenes, no como vistas alternativas.
 */
import type { ActionItemFull } from "./waterfall";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PurchaseGapRow {
  key: string;
  sku: string;
  skuComercial: string;
  talle: string;
  description: string;
  brand: string;
  linea: string;
  categoria: string;
  totalGapUnits: number;
  totalIdealUnits: number;
  totalSuggestedUnits: number;
  estimatedRevenue: number;
  storeCount: number;
}

export interface BrandSummary {
  brand: string;
  totalGapUnits: number;
  totalRevenue: number;
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Builds SKU-level gap rows for purchase planning.
 *
 * Deduplicates by (store, sku, talle) before aggregating to avoid
 * double-counting when a store has both N1 and N2 actions for the same SKU.
 * Takes the max gap per unique combination.
 *
 * Groups by (sku, talle) — one row per product-size combination.
 * Each row carries brand/linea/categoria for filtering in the UI.
 *
 * Only includes items where gapUnits > 0 (actual unmet demand).
 */
export function buildPurchasePlan(items: ActionItemFull[]): PurchaseGapRow[] {
  // Step 1: Deduplicate by (store, sku, talle) — take max gap per combination
  const dedup = new Map<string, ActionItemFull>();
  for (const item of items) {
    if (item.gapUnits <= 0) continue;
    const dedupKey = `${item.store}|${item.sku}|${item.talle}`;
    const existing = dedup.get(dedupKey);
    if (!existing || item.gapUnits > existing.gapUnits) {
      dedup.set(dedupKey, item);
    }
  }

  if (dedup.size === 0) return [];

  // Step 2: Group by (sku, talle) — aggregate across stores
  const groups = new Map<string, {
    item: ActionItemFull; // representative item for metadata
    gapUnits: number;
    idealUnits: number;
    suggestedUnits: number;
    revenue: number;
    stores: Set<string>;
  }>();

  for (const item of dedup.values()) {
    const key = `${item.sku}|||${item.talle}`;
    const existing = groups.get(key);
    if (existing) {
      existing.gapUnits += item.gapUnits;
      existing.idealUnits += item.idealUnits;
      existing.suggestedUnits += item.suggestedUnits;
      existing.revenue += item.gapUnits * getRevenuePerUnit(item);
      existing.stores.add(item.store);
    } else {
      groups.set(key, {
        item,
        gapUnits: item.gapUnits,
        idealUnits: item.idealUnits,
        suggestedUnits: item.suggestedUnits,
        revenue: item.gapUnits * getRevenuePerUnit(item),
        stores: new Set([item.store]),
      });
    }
  }

  // Step 3: Convert to array and sort by gap descending
  const rows: PurchaseGapRow[] = [];
  for (const [key, g] of groups) {
    rows.push({
      key,
      sku: g.item.sku,
      skuComercial: g.item.skuComercial,
      talle: g.item.talle,
      description: g.item.description,
      brand: g.item.brand,
      linea: g.item.linea || "Sin línea",
      categoria: g.item.categoria || "Sin categoría",
      totalGapUnits: g.gapUnits,
      totalIdealUnits: g.idealUnits,
      totalSuggestedUnits: g.suggestedUnits,
      estimatedRevenue: g.revenue,
      storeCount: g.stores.size,
    });
  }

  rows.sort((a, b) => b.totalGapUnits - a.totalGapUnits);
  return rows;
}

/**
 * Computes summary totals per brand from purchase plan rows.
 */
export function summarizeByBrand(rows: PurchaseGapRow[]): BrandSummary[] {
  const map = new Map<string, { gap: number; rev: number }>();
  for (const r of rows) {
    const existing = map.get(r.brand);
    if (existing) {
      existing.gap += r.totalGapUnits;
      existing.rev += r.estimatedRevenue;
    } else {
      map.set(r.brand, { gap: r.totalGapUnits, rev: r.estimatedRevenue });
    }
  }
  const result: BrandSummary[] = [];
  for (const [brand, { gap, rev }] of map) {
    result.push({ brand, totalGapUnits: gap, totalRevenue: rev });
  }
  result.sort((a, b) => b.totalGapUnits - a.totalGapUnits);
  return result;
}

/**
 * Computes totals across all gap rows (for summary display).
 */
export function computeGapTotals(rows: PurchaseGapRow[]): {
  totalGapUnits: number;
  totalRevenue: number;
} {
  let totalGapUnits = 0;
  let totalRevenue = 0;
  for (const r of rows) {
    totalGapUnits += r.totalGapUnits;
    totalRevenue += r.estimatedRevenue;
  }
  return { totalGapUnits, totalRevenue };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRevenuePerUnit(item: ActionItemFull): number {
  if (item.suggestedUnits > 0) {
    return item.impactScore / item.suggestedUnits;
  }
  if (item.idealUnits > 0) {
    return item.impactScore / item.idealUnits;
  }
  return 0;
}
